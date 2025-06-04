const pool = require('../db');

// Registrar Factura Completa de Proveedor (con todas las validaciones integradas)
async function RegistrarFacturasProveedor(req, res) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      nit_proveedor,
      fecha_compra,
      metodo_pago,
      valor_total, // Ahora recibido del frontend
      productos // Array de productos: [{referencia, cantidad, precio_unitario}, ...]
    } = req.body;

    // Validaciones básicas de campos obligatorios
    if (!nit_proveedor || !fecha_compra || !metodo_pago || !valor_total) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios: NIT proveedor, fecha de compra, método de pago y valor total.'
      });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Debe agregar al menos un producto a la factura.'
      });
    }

    // Validar que el valor total sea un número positivo
    if (Number(valor_total) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'El valor total debe ser mayor a cero.'
      });
    }

    // Validar que el proveedor existe y está activo
    const [proveedor] = await connection.execute(
      'SELECT nit, nombre FROM proveedor WHERE TRIM(nit) = TRIM(?) AND estado = 1',
      [nit_proveedor]
    );

    if (proveedor.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        mensaje: 'El proveedor no existe o está inactivo. Verifique el NIT ingresado.'
      });
    }

    // Generar ID único para la factura
    const [maxId] = await connection.execute(
      'SELECT COALESCE(MAX(id_factura_proveedor), 0) + 1 as nuevo_id FROM factura_proveedor'
    );
    const id_factura_proveedor = maxId[0].nuevo_id;

    // Validar productos
    const productosValidados = [];
    const referenciasVistas = new Set(); // Para evitar duplicados

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];

      // Validar campos obligatorios del producto
      if (!producto.referencia || !producto.cantidad || !producto.precio_unitario) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El producto en la posición ${i + 1} debe tener referencia, cantidad y precio unitario.`
        });
      }

      // Convertir referencia a string y limpiar espacios
      const referenciaLimpia = String(producto.referencia).trim();
      
      // Log para debugging
      console.log(`🔍 Buscando producto con referencia: "${referenciaLimpia}" (tipo: ${typeof referenciaLimpia})`);

      // Validar que la cantidad y precio sean números positivos
      if (Number(producto.cantidad) <= 0 || Number(producto.precio_unitario) <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          mensaje: `El producto ${referenciaLimpia} debe tener cantidad y precio unitario mayores a cero.`
        });
      }

      // Validar que no haya referencias duplicadas en la misma factura
      if (referenciasVistas.has(referenciaLimpia)) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          mensaje: `La referencia ${referenciaLimpia} está duplicada en la factura. Cada producto debe aparecer solo una vez.`
        });
      }
      referenciasVistas.add(referenciaLimpia);

      // Validar que la referencia del producto existe (con TRIM para evitar problemas de espacios)
      const [productoExiste] = await connection.execute(
        'SELECT referencia, nombre FROM producto WHERE TRIM(referencia) = TRIM(?)',
        [referenciaLimpia]
      );

      console.log(`📦 Productos encontrados para referencia "${referenciaLimpia}":`, productoExiste.length);

      if (productoExiste.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          mensaje: `La referencia '${referenciaLimpia}' no existe en el sistema de productos.`
        });
      }

      const subtotal = Number(producto.cantidad) * Number(producto.precio_unitario);

      productosValidados.push({
        referencia: referenciaLimpia,
        nombre: productoExiste[0].nombre,
        cantidad: Number(producto.cantidad),
        precio_unitario: Number(producto.precio_unitario),
        subtotal: subtotal
      });
    }

    // Insertar factura de proveedor (usando valor_total del frontend)
    await connection.execute(
      `INSERT INTO factura_proveedor 
       (id_factura_proveedor, fecha_compra, valor_total, metodo_pago, nit_proveedor)
       VALUES (?, ?, ?, ?, ?)`,
      [id_factura_proveedor, fecha_compra, Number(valor_total), metodo_pago, nit_proveedor]
    );

    // Insertar detalles de la factura (esto activará el trigger que aumenta el stock)
    for (const producto of productosValidados) {
      await connection.execute(
        `INSERT INTO detalle_factura_proveedor 
         (FK_id_factura_proveedor, FK_referencia, cantidad, precio_unitario)
         VALUES (?, ?, ?, ?)`,
        [id_factura_proveedor, producto.referencia, producto.cantidad, producto.precio_unitario]
      );
    }

    await connection.commit();

    // Funciones para formatear la respuesta
    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    const formatearFecha = (fecha) => {
      return new Date(fecha).toLocaleDateString('es-CO');
    };

    return res.status(201).json({
      success: true,
      mensaje: 'Factura de proveedor registrada exitosamente.',
      factura: {
        id_factura_proveedor,
        nit_proveedor,
        nombre_proveedor: proveedor[0].nombre,
        fecha_compra: formatearFecha(fecha_compra),
        metodo_pago,
        valor_total: formatearNumero(valor_total), // Usando el valor del frontend
        total_productos: productosValidados.length,
        productos: productosValidados.map(p => ({
          referencia: p.referencia,
          nombre: p.nombre,
          cantidad: p.cantidad,
          precio_unitario: formatearNumero(p.precio_unitario),
          subtotal: formatearNumero(p.subtotal)
        }))
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al registrar factura de proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar la factura de proveedor.'
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  RegistrarFacturasProveedor
};