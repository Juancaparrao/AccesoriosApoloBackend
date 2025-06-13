const pool = require('../db');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

// Función para generar inventario (manual o automático)
async function GenerarInventario(req, res) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Determinar el responsable (manual vs automático)
    let responsable = 'Sistema';
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        responsable = decoded.nombre || 'Usuario';
      } catch (tokenError) {
        console.log('Token inválido, usando Sistema como responsable');
      }
    }

    // Obtener todos los productos activos con stock
    const [productos] = await connection.execute(`
      SELECT 
        referencia,
        nombre,
        stock,
        precio_unidad,
        marca
      FROM producto 
      WHERE estado = 1 AND stock > 0
      ORDER BY nombre
    `);

    if (productos.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'No hay productos disponibles para generar inventario.'
      });
    }

    // Calcular totales
    const cantidad_productos = productos.length;
    const cantidad_unidades = productos.reduce((total, producto) => total + producto.stock, 0);
    let valor_total = 0;

    // Crear registro principal de inventario
    const [inventarioResult] = await connection.execute(`
      INSERT INTO inventario (fecha_creacion, cantidad_productos, cantidad_unidades, valor_total, responsable)
      VALUES (CURDATE(), ?, ?, 0, ?)
    `, [cantidad_productos, cantidad_unidades, responsable]);

    const id_inventario = inventarioResult.insertId;

    // Insertar detalles del inventario y calcular valor total
    for (const producto of productos) {
      const subtotal = producto.stock * producto.precio_unidad;
      valor_total += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario 
        (FK_id_inventario, FK_referencia_producto, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `, [id_inventario, producto.referencia, producto.stock, producto.precio_unidad, subtotal]);
    }

    // Actualizar el valor total en la tabla inventario
    await connection.execute(`
      UPDATE inventario 
      SET valor_total = ? 
      WHERE id_inventario = ?
    `, [valor_total, id_inventario]);

    await connection.commit();

    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    return res.status(201).json({
      success: true,
      mensaje: 'Inventario generado exitosamente',
      inventario: {
        id: id_inventario,
        fecha_creacion: new Date().toLocaleDateString('es-CO'),
        cantidad_productos: formatearNumero(cantidad_productos),
        cantidad_unidades: formatearNumero(cantidad_unidades),
        valor_total: formatearNumero(valor_total),
        responsable: responsable
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al generar inventario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al generar el inventario.'
    });
  } finally {
    connection.release();
  }
}

// Función para generar inventario automáticamente (sin response)
async function GenerarInventarioAutomatico() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    console.log('🕐 Iniciando generación automática de inventario...');

    // Verificar si ya existe un inventario para hoy
    const [inventarioHoy] = await connection.execute(`
      SELECT id_inventario 
      FROM inventario 
      WHERE fecha_creacion = CURDATE()
      LIMIT 1
    `);

    if (inventarioHoy.length > 0) {
      console.log('ℹ️ Ya existe un inventario para hoy, saltando generación automática.');
      await connection.rollback();
      return;
    }

    // Obtener todos los productos activos con stock
    const [productos] = await connection.execute(`
      SELECT 
        referencia,
        nombre,
        stock,
        precio_unidad,
        marca
      FROM producto 
      WHERE estado = 1 AND stock > 0
      ORDER BY nombre
    `);

    if (productos.length === 0) {
      console.log('⚠️ No hay productos disponibles para generar inventario automático.');
      await connection.rollback();
      return;
    }

    // Calcular totales
    const cantidad_productos = productos.length;
    const cantidad_unidades = productos.reduce((total, producto) => total + producto.stock, 0);
    let valor_total = 0;

    // Crear registro principal de inventario
    const [inventarioResult] = await connection.execute(`
      INSERT INTO inventario (fecha_creacion, cantidad_productos, cantidad_unidades, valor_total, responsable)
      VALUES (CURDATE(), ?, ?, 0, 'Sistema')
    `, [cantidad_productos, cantidad_unidades]);

    const id_inventario = inventarioResult.insertId;

    // Insertar detalles del inventario y calcular valor total
    for (const producto of productos) {
      const subtotal = producto.stock * producto.precio_unidad;
      valor_total += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario 
        (FK_id_inventario, FK_referencia_producto, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `, [id_inventario, producto.referencia, producto.stock, producto.precio_unidad, subtotal]);
    }

    // Actualizar el valor total en la tabla inventario
    await connection.execute(`
      UPDATE inventario 
      SET valor_total = ? 
      WHERE id_inventario = ?
    `, [valor_total, id_inventario]);

    await connection.commit();

    console.log(`✅ Inventario automático generado exitosamente - ID: ${id_inventario}`);
    console.log(`📊 Productos: ${cantidad_productos}, Unidades: ${cantidad_unidades}, Valor: $${valor_total.toLocaleString('es-CO')}`);

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al generar inventario automático:', error);
  } finally {
    connection.release();
  }
}

// Programar la ejecución automática todos los días a las 8:00 AM
// Formato: segundo minuto hora día mes día_semana
cron.schedule('0 0 8 * * *', () => {
  console.log('🔄 Ejecutando generación automática de inventario...');
  GenerarInventarioAutomatico();
}, {
  scheduled: true,
  timezone: "America/Bogota"
});

console.log('⏰ Cron job configurado: Inventario automático todos los días a las 8:00 AM');

module.exports = { 
  GenerarInventario,
  GenerarInventarioAutomatico 
};