const pool = require('../db');
const emailService = require('../templates/FacturaVentaCorreo'); // Importar el servicio de correo

// Controlador para validar cliente por cédula (SIN CAMBIOS)
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

// Controlador para buscar producto por referencia (para ventas) (SIN CAMBIOS)
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

// Controlador para buscar calcomanía por ID (para ventas) (SIN CAMBIOS)
async function BuscarCalcomaniaVentaPorId(req, res) {
  try {
    const { id, tamano, cantidad } = req.query;

    // Validaciones iniciales
    if (!id) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de la calcomanía es requerido.'
      });
    }

    if (!tamano || !['pequeno', 'mediano', 'grande'].includes(tamano)) {
      return res.status(400).json({
        success: false,
        mensaje: 'El tamaño de la calcomanía (pequeno, mediano o grande) es requerido y debe ser válido.'
      });
    }

    if (isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'La cantidad debe ser un número entero positivo.'
      });
    }

    // Consulta la calcomanía en la base de datos
    const [calcomaniaRows] = await pool.execute(
      `SELECT
         id_calcomania,
         nombre,
         precio_unidad,
         precio_descuento,
         stock_pequeno,
         stock_mediano,
         stock_grande,
         estado
       FROM calcomania
       WHERE id_calcomania = ? AND estado = 1`,
      [id]
    );

    // Verifica si la calcomanía existe y está activa
    if (calcomaniaRows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Calcomanía no encontrada o inactiva.'
      });
    }

    const calcomania = calcomaniaRows[0];
    let precio_unidad_actualizado = parseFloat(calcomania.precio_unidad);
    let stock_disponible;

    // Calcula el precio actualizado y verifica el stock según el tamaño
    switch (tamano) {
      case 'pequeno':
        stock_disponible = calcomania.stock_pequeno;
        // El precio_unidad se mantiene igual para 'pequeno'
        break;
      case 'mediano':
        precio_unidad_actualizado += precio_unidad_actualizado * 1.25; // Se le suma el 125%
        stock_disponible = calcomania.stock_mediano;
        break;
      case 'grande':
        precio_unidad_actualizado += precio_unidad_actualizado * 3.00; // Se le suma el 300%
        stock_disponible = calcomania.stock_grande;
        break;
    }

    // Verifica si hay suficiente stock para el tamaño y cantidad solicitada
    if (stock_disponible <= 0 || parseInt(cantidad) > stock_disponible) {
      return res.status(400).json({
        success: false,
        mensaje: `No hay suficiente stock disponible para el tamaño "${tamano}". Stock actual: ${stock_disponible}.`
      });
    }

    let precio_final_para_calculo = precio_unidad_actualizado;
    let precio_con_descuento_aplicado = null;

    // Aplica el descuento si existe
    if (calcomania.precio_descuento !== null && calcomania.precio_descuento > 0) {
      const descuento_percent = parseFloat(calcomania.precio_descuento);
      // Asegúrate de que el descuento sea un porcentaje válido (0-100)
      if (descuento_percent > 0 && descuento_percent <= 100) {
        precio_con_descuento_aplicado = precio_unidad_actualizado * (1 - (descuento_percent / 100));
        precio_final_para_calculo = precio_con_descuento_aplicado;
      }
    }

    // Calcula el subtotal
    const subtotal = precio_final_para_calculo * parseInt(cantidad);

    // Prepara la información de la calcomanía para la respuesta
    const calcomaniaInfo = {
      id_calcomania: calcomania.id_calcomania,
      nombre: calcomania.nombre,
      precio_unidad: parseFloat(precio_unidad_actualizado.toFixed(2)), // Precio ya actualizado por tamaño
      precio_descuento: precio_con_descuento_aplicado ? parseFloat(precio_con_descuento_aplicado.toFixed(2)) : null,
      subtotal: parseFloat(subtotal.toFixed(2)) // Subtotal calculado
    };

    // Envía la respuesta exitosa
    return res.status(200).json({
      success: true,
      calcomania: calcomaniaInfo
    });

  } catch (error) {
    console.error('Error al buscar calcomanía:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al buscar la calcomanía.'
    });
  }
}

async function RegistrarVenta(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      cedula_cliente,
      metodo_pago,
      fecha_venta, // Fecha que viene del frontend
      valor_total, // Valor total calculado por el frontend
      productos = [], // Array de productos: [{referencia, cantidad, precio_usado}, ...]
      calcomanias = [], // Array de calcomanias: [{id_calcomania, cantidad, tamano, precio_usado}, ...]
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

    // Debe haber al menos un producto o una calcomanía
    if (productos.length === 0 && calcomanias.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Debe agregar al menos un producto o una calcomanía a la venta.'
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

    // --- Procesamiento y validación de Productos ---
    const productosValidados = [];
    const referenciasVistas = new Set();

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];

      if (!producto.referencia || !producto.cantidad || producto.precio_usado === undefined || producto.precio_usado === null) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El producto en la posición ${i + 1} debe tener referencia, cantidad y precio_usado.`
        });
      }

      const referenciaLimpia = String(producto.referencia).trim();

      if (referenciasVistas.has(referenciaLimpia)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          mensaje: `La referencia ${referenciaLimpia} está duplicada en la venta de productos.`
        });
      }
      referenciasVistas.add(referenciaLimpia);

      if (Number(producto.cantidad) <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `La cantidad del producto ${referenciaLimpia} debe ser mayor a cero.`
        });
      }

      const [productoExistente] = await connection.execute(
        'SELECT referencia, nombre, stock, precio_unidad, precio_descuento, estado FROM producto WHERE TRIM(referencia) = TRIM(?)',
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

      if (productoExistente[0].stock < Number(producto.cantidad)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `Stock insuficiente para el producto ${productoExistente[0].nombre}. Stock disponible: ${productoExistente[0].stock}, solicitado: ${producto.cantidad}`
        });
      }

      // **Validar que el precio_usado del frontend sea coherente con la BD**
      let precio_esperado;
      if (productoExistente[0].precio_descuento && parseFloat(productoExistente[0].precio_descuento) > 0) {
        precio_esperado = parseFloat(productoExistente[0].precio_descuento);
      } else {
        precio_esperado = parseFloat(productoExistente[0].precio_unidad);
      }

      // Permitir una pequeña variación por errores de coma flotante si es necesario
      if (Math.abs(parseFloat(producto.precio_usado) - precio_esperado) > 0.01) {
          // console.warn(`Advertencia: Precio usado para ${referenciaLimpia} (${producto.precio_usado}) difiere del esperado en BD (${precio_esperado}). Se usará el precio del frontend.`);
          // O podrías hacer: precio_usado = precio_esperado; para forzar el precio de BD
      }

      productosValidados.push({
        referencia: referenciaLimpia,
        nombre: productoExistente[0].nombre,
        cantidad: Number(producto.cantidad),
        precio_unidad_original: parseFloat(productoExistente[0].precio_unidad), // Para referencia en el email
        precio_descuento_original: productoExistente[0].precio_descuento ? parseFloat(productoExistente[0].precio_descuento) : null,
        precio_usado: parseFloat(producto.precio_usado), // Usamos el que viene del frontend (validado para coherencia)
        stock_disponible_bd: productoExistente[0].stock // Para referencia
      });
    }

    // --- Procesamiento y validación de Calcomanías ---
    const calcomaniasValidadas = [];
    const calcomaniasVistas = new Set();

    for (let i = 0; i < calcomanias.length; i++) {
      const calcomania = calcomanias[i];

      if (!calcomania.id_calcomania || !calcomania.cantidad || !calcomania.tamano || calcomania.precio_usado === undefined || calcomania.precio_usado === null) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `La calcomanía en la posición ${i + 1} debe tener id_calcomania, cantidad, tamaño y precio_usado.`
        });
      }

      const idCalcomaniaLimpia = parseInt(calcomania.id_calcomania);
      const tamanoCalcomania = String(calcomania.tamano).toLowerCase();

      if (!['pequeno', 'mediano', 'grande'].includes(tamanoCalcomania)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El tamaño de la calcomanía (pequeno, mediano o grande) en la posición ${i + 1} debe ser válido.`
        });
      }

      const claveUnicaCalcomania = `${idCalcomaniaLimpia}-${tamanoCalcomania}`;
      if (calcomaniasVistas.has(claveUnicaCalcomania)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          mensaje: `La calcomanía con ID ${idCalcomaniaLimpia} y tamaño ${tamanoCalcomania} está duplicada en la venta.`
        });
      }
      calcomaniasVistas.add(claveUnicaCalcomania);

      if (Number(calcomania.cantidad) <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `La cantidad de la calcomanía ${idCalcomaniaLimpia} debe ser mayor a cero.`
        });
      }

      const [calcomaniaExistente] = await connection.execute(
        `SELECT
           id_calcomania,
           nombre,
           precio_unidad,
           precio_descuento,
           stock_pequeno,
           stock_mediano,
           stock_grande,
           estado
         FROM calcomania
         WHERE id_calcomania = ?`,
        [idCalcomaniaLimpia]
      );

      if (calcomaniaExistente.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          mensaje: `La calcomanía con ID ${idCalcomaniaLimpia} no existe.`
        });
      }

      if (!calcomaniaExistente[0].estado) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `La calcomanía ${calcomaniaExistente[0].nombre} está inactiva.`
        });
      }

      let stock_disponible_calcomania;
      let precio_unidad_base_calcomania = parseFloat(calcomaniaExistente[0].precio_unidad);
      let precio_calculado_segun_tamano = precio_unidad_base_calcomania;

      switch (tamanoCalcomania) {
        case 'pequeno':
          stock_disponible_calcomania = calcomaniaExistente[0].stock_pequeno;
          break;
        case 'mediano':
          stock_disponible_calcomania = calcomaniaExistente[0].stock_mediano;
          precio_calculado_segun_tamano += precio_calculado_segun_tamano * 1.25;
          break;
        case 'grande':
          stock_disponible_calcomania = calcomaniaExistente[0].stock_grande;
          precio_calculado_segun_tamano += precio_calculado_segun_tamano * 3.00;
          break;
      }

      if (stock_disponible_calcomania < Number(calcomania.cantidad)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `Stock insuficiente para la calcomanía ${calcomaniaExistente[0].nombre} (tamaño ${tamanoCalcomania}). Stock disponible: ${stock_disponible_calcomania}, solicitado: ${calcomania.cantidad}`
        });
      }

      // **Validar que el precio_usado del frontend sea coherente con la BD para calcomanías**
      let precio_esperado_calcomania;
      if (calcomaniaExistente[0].precio_descuento && parseFloat(calcomaniaExistente[0].precio_descuento) > 0) {
          // Si hay un descuento en la BD, aplicarlo al precio calculado por tamaño
          const descuento_percent = parseFloat(calcomaniaExistente[0].precio_descuento);
          precio_esperado_calcomania = precio_calculado_segun_tamano * (1 - (descuento_percent / 100));
      } else {
          precio_esperado_calcomania = precio_calculado_segun_tamano;
      }

      if (Math.abs(parseFloat(calcomania.precio_usado) - precio_esperado_calcomania) > 0.01) {
          // console.warn(`Advertencia: Precio usado para calcomanía ${idCalcomaniaLimpia} (${calcomania.precio_usado}) difiere del esperado en BD (${precio_esperado_calcomania}). Se usará el precio del frontend.`);
          // O podrías hacer: calcomania.precio_usado = precio_esperado_calcomania;
      }

      calcomaniasValidadas.push({
        id_calcomania: idCalcomaniaLimpia,
        nombre: calcomaniaExistente[0].nombre,
        cantidad: Number(calcomania.cantidad),
        tamano: tamanoCalcomania,
        precio_unidad_original: precio_unidad_base_calcomania, // Precio base de la BD
        precio_descuento_original: calcomaniaExistente[0].precio_descuento ? parseFloat(calcomaniaExistente[0].precio_descuento) : null,
        precio_usado: parseFloat(calcomania.precio_usado), // Usamos el que viene del frontend (validado para coherencia)
        stock_disponible_bd: stock_disponible_calcomania // Para referencia
      });
    }

    // Procesar la fecha de venta
    let fecha_venta_formateada;
    if (fecha_venta) {
      const fechaObj = new Date(fecha_venta);
      if (isNaN(fechaObj.getTime())) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: 'La fecha de venta proporcionada no es válida'
        });
      }
      fecha_venta_formateada = fechaObj.toISOString().split('T')[0];
    } else {
      fecha_venta_formateada = new Date().toISOString().split('T')[0];
    }

    // Insertar factura
    await connection.execute(
      `INSERT INTO factura (id_factura, fecha_venta, metodo_pago, valor_total, fk_id_usuario)
       VALUES (?, ?, ?, ?, ?)`,
      [id_factura, fecha_venta_formateada, metodo_pago, Number(valor_total), cliente[0].id_usuario]
    );

    // Insertar detalles de productos y actualizar stock de productos
    for (const producto of productosValidados) {
      await connection.execute(
        `INSERT INTO detalle_factura
         (FK_id_factura, FK_referencia_producto, cantidad, precio_unidad)
         VALUES (?, ?, ?, ?)`,
        [id_factura, producto.referencia, producto.cantidad, producto.precio_usado]
      );

      await connection.execute(
        `UPDATE producto
         SET stock = stock - ?
         WHERE referencia = ?`,
        [producto.cantidad, producto.referencia]
      );
      console.log(`✅ Producto vendido: ${producto.referencia} - Cantidad: ${producto.cantidad} - Stock actualizado.`);
    }

    // Insertar detalles de calcomanías y actualizar stock de calcomanías
    for (const calcomania of calcomaniasValidadas) {
      await connection.execute(
        `INSERT INTO detalle_factura_calcomania
         (FK_id_factura, FK_id_calcomania, cantidad, precio_unidad, tamano)
         VALUES (?, ?, ?, ?, ?)`,
        [id_factura, calcomania.id_calcomania, calcomania.cantidad, calcomania.precio_usado, calcomania.tamano]
      );

      // Actualizar stock de calcomanía según el tamaño
      let updateQuery;
      switch (calcomania.tamano) {
        case 'pequeno':
          updateQuery = `UPDATE calcomania SET stock_pequeno = stock_pequeno - ? WHERE id_calcomania = ?`;
          break;
        case 'mediano':
          updateQuery = `UPDATE calcomania SET stock_mediano = stock_mediano - ? WHERE id_calcomania = ?`;
          break;
        case 'grande':
          updateQuery = `UPDATE calcomania SET stock_grande = stock_grande - ? WHERE id_calcomania = ?`;
          break;
      }
      await connection.execute(updateQuery, [calcomania.cantidad, calcomania.id_calcomania]);
      console.log(`✅ Calcomanía vendida: ${calcomania.nombre} (ID: ${calcomania.id_calcomania}, Tamaño: ${calcomania.tamano}) - Cantidad: ${calcomania.cantidad} - Stock actualizado.`);
    }

    await connection.commit();

    // Preparar datos de la factura para respuesta y email
    const facturaData = {
      id_factura,
      fecha_venta: new Date(fecha_venta_formateada).toLocaleDateString('es-CO'),
      metodo_pago,
      valor_total_numerico: Number(valor_total),
      cliente: {
        cedula: cliente[0].cedula,
        nombre: cliente[0].nombre,
        correo: cliente[0].correo,
        telefono: cliente[0].telefono
      },
      // Formatear productos para el email/respuesta
      productos: productosValidados.map(p => ({
        referencia: p.referencia,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio_unitario: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_usado),
        // Calcular subtotal del item para el email
        subtotal_item: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_usado * p.cantidad),
        tiene_descuento: p.precio_descuento_original !== null && p.precio_descuento_original > 0,
        precio_original_sin_descuento: p.precio_descuento_original ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p.precio_unidad_original) : null
      })),
      // Formatear calcomanías para el email/respuesta
      calcomanias: calcomaniasValidadas.map(c => ({
        id: c.id_calcomania,
        nombre: c.nombre,
        cantidad: c.cantidad,
        tamano: c.tamano,
        precio_unitario: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_usado),
        // Calcular subtotal del item para el email
        subtotal_item: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_usado * c.cantidad),
        tiene_descuento: c.precio_descuento_original !== null && c.precio_descuento_original > 0,
        precio_original_sin_descuento_base: c.precio_descuento_original ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(c.precio_unidad_original) : null
      })),
      valor_total: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(valor_total)),
      total_items: productosValidados.length + calcomaniasValidadas.length
    };

    // Enviar correo con PDF si se solicita
    if (enviar_correo && cliente[0].correo) {
      try {
        await emailService.enviarFacturaPorCorreo(cliente[0].correo, facturaData);
        console.log(`📧 Correo con factura enviado a: ${cliente[0].correo}`);
      } catch (emailError) {
        console.error('❌ Error al enviar correo:', emailError);
        // No revertir la transacción por un error de envío de correo, solo registrar el error
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
  BuscarCalcomaniaVentaPorId,
  RegistrarVenta
};