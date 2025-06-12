const pool = require('../db');
const emailService = require('../templates/FacturaVentaCorreo'); // Importar el servicio de correo

// Controlador para validar cliente por cédula
async function ValidarClientePorCedula(req, res) {
  try {
    const { cedula } = req.query;
    
    if (!cedula) {
      return res.status(400).json({
        success: false,
        mensaje: 'La cédula del cliente es requerida'
      });
    }

    const [cliente] = await pool.execute(
      'SELECT id_usuario, cedula, nombre, correo, telefono, estado FROM usuario WHERE cedula = ?',
      [cedula]
    );

    if (cliente.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'La cédula no está registrada en el sistema'
      });
    }

    // Verificar si el cliente está activo
    if (!cliente[0].estado) {
      return res.status(403).json({
        success: false,
        mensaje: 'El usuario está inactivo'
      });
    }

    return res.status(200).json({
      success: true,
      cliente: {
        id_usuario: cliente[0].id_usuario,
        cedula: cliente[0].cedula,
        nombre: cliente[0].nombre,
        correo: cliente[0].correo,
        telefono: cliente[0].telefono
      }
    });

  } catch (error) {
    console.error('Error al validar cliente:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al validar el cliente'
    });
  }
}

// Controlador para buscar producto por referencia (para ventas)
async function BuscarProductoVentaPorReferencia(req, res) {
  try {
    const { referencia } = req.query;
    
    if (!referencia) {
      return res.status(400).json({
        success: false,
        mensaje: 'La referencia del producto es requerida'
      });
    }

    const [producto] = await pool.execute(
      `SELECT referencia, nombre, stock, precio_unidad, descuento, precio_descuento, estado 
       FROM producto 
       WHERE TRIM(referencia) = TRIM(?) AND estado = 1`,
      [referencia]
    );

    if (producto.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado o inactivo'
      });
    }

    // Verificar si hay stock disponible
    if (producto[0].stock <= 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'Producto sin stock disponible'
      });
    }

    const productoInfo = {
      referencia: producto[0].referencia,
      nombre: producto[0].nombre,
      stock: producto[0].stock,
      precio_unidad: parseFloat(producto[0].precio_unidad),
      descuento: producto[0].descuento,
      precio_descuento: producto[0].precio_descuento ? parseFloat(producto[0].precio_descuento) : null
    };

    return res.status(200).json({
      success: true,
      producto: productoInfo
    });

  } catch (error) {
    console.error('Error al buscar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al buscar el producto'
    });
  }
}

// Controlador para registrar venta
async function RegistrarVenta(req, res) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      cedula_cliente,
      metodo_pago,
      fecha_venta, // Fecha que viene del frontend
      valor_total, // Valor total calculado por el frontend
      productos, // Array de productos: [{referencia, nombre, cantidad, precio_unidad, precio_descuento?}, ...]
      enviar_correo = false // Boolean para saber si enviar correo con PDF
    } = req.body;

    // Validaciones básicas de campos obligatorios
    if (!cedula_cliente || !metodo_pago || valor_total === undefined || valor_total === null) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: cédula del cliente, método de pago y valor total.'
      });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Debe agregar al menos un producto a la venta.'
      });
    }

    // Validar que el valor total sea positivo
    if (Number(valor_total) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'El valor total debe ser mayor a cero.'
      });
    }

    // Validar que el cliente existe y está activo
    const [cliente] = await connection.execute(
      'SELECT id_usuario, cedula, nombre, correo, telefono, estado FROM usuario WHERE cedula = ?',
      [cedula_cliente]
    );

    if (cliente.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        mensaje: 'El cliente no existe. Verifique la cédula ingresada.'
      });
    }

    if (!cliente[0].estado) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        mensaje: 'El cliente está inactivo.'
      });
    }

    // Generar ID único para la factura
    const [maxId] = await connection.execute(
      'SELECT COALESCE(MAX(id_factura), 0) + 1 as nuevo_id FROM factura'
    );
    const id_factura = maxId[0].nuevo_id;

    // Validar productos y verificar stock disponible
    const productosValidados = [];
    const referenciasVistas = new Set();

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];

      // Validar campos obligatorios del producto
      if (!producto.referencia || !producto.cantidad) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El producto en la posición ${i + 1} debe tener referencia y cantidad.`
        });
      }

      const referenciaLimpia = String(producto.referencia).trim();
      
      // Validar que no haya referencias duplicadas
      if (referenciasVistas.has(referenciaLimpia)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          mensaje: `La referencia ${referenciaLimpia} está duplicada en la venta.`
        });
      }
      referenciasVistas.add(referenciaLimpia);

      // Validar cantidad
      if (Number(producto.cantidad) <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `La cantidad del producto ${referenciaLimpia} debe ser mayor a cero.`
        });
      }

      // Verificar que el producto existe, está activo y tiene stock
      const [productoExistente] = await connection.execute(
        'SELECT referencia, nombre, stock, precio_unidad, descuento, precio_descuento, estado FROM producto WHERE TRIM(referencia) = TRIM(?)',
        [referenciaLimpia]
      );

      if (productoExistente.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          mensaje: `El producto con referencia ${referenciaLimpia} no existe.`
        });
      }

      if (!productoExistente[0].estado) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El producto ${productoExistente[0].nombre} está inactivo.`
        });
      }

      // Verificar stock disponible
      if (productoExistente[0].stock < Number(producto.cantidad)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `Stock insuficiente para el producto ${productoExistente[0].nombre}. Stock disponible: ${productoExistente[0].stock}, solicitado: ${producto.cantidad}`
        });
      }

      // Determinar el precio usado (viene del frontend pero lo validamos con BD)
      const precio_a_usar = producto.precio_usado || 
        (productoExistente[0].precio_descuento && productoExistente[0].precio_descuento > 0 
          ? parseFloat(productoExistente[0].precio_descuento)
          : parseFloat(productoExistente[0].precio_unidad));

      productosValidados.push({
        referencia: referenciaLimpia,
        nombre: productoExistente[0].nombre,
        cantidad: Number(producto.cantidad),
        precio_unidad: parseFloat(productoExistente[0].precio_unidad),
        precio_descuento: productoExistente[0].precio_descuento ? parseFloat(productoExistente[0].precio_descuento) : null,
        precio_usado: precio_a_usar,
        stock_disponible: productoExistente[0].stock
      });
    }

    // Procesar la fecha de venta
    let fecha_venta_formateada;
    if (fecha_venta) {
      // Si viene del frontend, validar y formatear la fecha
      const fechaObj = new Date(fecha_venta);
      if (isNaN(fechaObj.getTime())) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: 'La fecha de venta proporcionada no es válida'
        });
      }
      // Formatear la fecha para MySQL (YYYY-MM-DD)
      fecha_venta_formateada = fechaObj.toISOString().split('T')[0];
    } else {
      // Si no viene fecha del frontend, usar la fecha actual
      fecha_venta_formateada = new Date().toISOString().split('T')[0];
    }

    // Insertar factura CON EL VALOR TOTAL QUE VIENE DEL FRONTEND
    await connection.execute(
      `INSERT INTO factura (id_factura, fecha_venta, metodo_pago, valor_total, fk_id_usuario)
       VALUES (?, ?, ?, ?, ?)`,
      [id_factura, fecha_venta_formateada, metodo_pago, Number(valor_total), cliente[0].id_usuario]
    );

    // Insertar detalles de la factura (el trigger se encarga de restar el stock)
    for (const producto of productosValidados) {
      await connection.execute(
        `INSERT INTO detalle_factura 
         (FK_id_factura, FK_referencia, cantidad, precio_unidad)
         VALUES (?, ?, ?, ?)`,
        [id_factura, producto.referencia, producto.cantidad, producto.precio_usado]
      );

      console.log(`✅ Producto vendido: ${producto.referencia} - Cantidad: ${producto.cantidad} - Stock restado automáticamente por trigger`);
    }

    await connection.commit();

    // Preparar datos de la factura para respuesta
    const facturaData = {
      id_factura,
      fecha_venta: new Date(fecha_venta_formateada).toLocaleDateString('es-CO'),
      metodo_pago,
      valor_total_numerico: Number(valor_total), // Valor numérico que viene del frontend
      cliente: {
        cedula: cliente[0].cedula,
        nombre: cliente[0].nombre,
        correo: cliente[0].correo,
        telefono: cliente[0].telefono
      },
      productos: productosValidados.map(p => ({
        referencia: p.referencia,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio_unitario: new Intl.NumberFormat('es-CO').format(p.precio_usado),
        tiene_descuento: p.precio_descuento && p.precio_descuento > 0,
        precio_original: p.precio_descuento ? new Intl.NumberFormat('es-CO').format(p.precio_unidad) : null
      })),
      valor_total: new Intl.NumberFormat('es-CO').format(Number(valor_total)),
      total_productos: productosValidados.length
    };

    // Enviar correo con PDF si se solicita
    if (enviar_correo && cliente[0].correo) {
      try {
        await emailService.enviarFacturaPorCorreo(cliente[0].correo, facturaData);
        console.log(`📧 Correo con factura enviado a: ${cliente[0].correo}`);
      } catch (emailError) {
        console.error('❌ Error al enviar correo:', emailError);
        // No fallar la transacción por error de correo, solo registrar el error
      }
    }

    return res.status(201).json({
      success: true,
      mensaje: 'Venta registrada exitosamente' + (enviar_correo ? ' y correo enviado.' : '.'),
      factura: facturaData
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al registrar venta:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar la venta.'
    });
  } finally {
    connection.release();
  }
}

// Exportamos los métodos
module.exports = {
  ValidarClientePorCedula,
  BuscarProductoVentaPorReferencia,
  RegistrarVenta
};