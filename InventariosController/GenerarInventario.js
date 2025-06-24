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

    const fechaHoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    console.log(`🕐 [${new Date().toLocaleString('es-CO')}] Iniciando generación automática de inventario...`);

    // Verificar si ya existe un inventario para hoy
    const [inventarioHoy] = await connection.execute(`
      SELECT id_inventario 
      FROM inventario 
      WHERE DATE(fecha_creacion) = CURDATE()
      LIMIT 1
    `);

    if (inventarioHoy.length > 0) {
      console.log(`ℹ️ [${new Date().toLocaleString('es-CO')}] Ya existe un inventario para hoy (ID: ${inventarioHoy[0].id_inventario}), saltando generación automática.`);
      await connection.rollback();
      return { success: true, message: 'Inventario ya existe para hoy' };
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
      console.log(`⚠️ [${new Date().toLocaleString('es-CO')}] No hay productos disponibles para generar inventario automático.`);
      await connection.rollback();
      return { success: false, message: 'No hay productos disponibles' };
    }

    // Calcular totales
    const cantidad_productos = productos.length;
    const cantidad_unidades = productos.reduce((total, producto) => total + producto.stock, 0);
    let valor_total = 0;

    // Crear registro principal de inventario
    const [inventarioResult] = await connection.execute(`
      INSERT INTO inventario (fecha_creacion, cantidad_productos, cantidad_unidades, valor_total, responsable)
      VALUES (NOW(), ?, ?, 0, 'Sistema Automático')
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

    const mensaje = `✅ [${new Date().toLocaleString('es-CO')}] Inventario automático generado exitosamente - ID: ${id_inventario}`;
    const estadisticas = `📊 Productos: ${cantidad_productos.toLocaleString('es-CO')}, Unidades: ${cantidad_unidades.toLocaleString('es-CO')}, Valor: $${valor_total.toLocaleString('es-CO')}`;
    
    console.log(mensaje);
    console.log(estadisticas);

    return { 
      success: true, 
      message: 'Inventario generado exitosamente',
      data: {
        id: id_inventario,
        productos: cantidad_productos,
        unidades: cantidad_unidades,
        valor: valor_total
      }
    };

  } catch (error) {
    await connection.rollback();
    const errorMsg = `❌ [${new Date().toLocaleString('es-CO')}] Error al generar inventario automático: ${error.message}`;
    console.error(errorMsg);
    console.error('Stack trace:', error.stack);
    return { success: false, message: error.message };
  } finally {
    connection.release();
  }
}

// Función para verificar el estado del cron job
function verificarEstadoCron() {
  console.log(`🔍 [${new Date().toLocaleString('es-CO')}] Verificando estado del sistema de inventario automático...`);
  console.log(`⏰ Próxima ejecución programada: Todos los días a las 8:00 AM (Zona horaria: America/Bogota)`);
  console.log(`🌐 Hora actual del servidor: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
}

// Función para probar la conexión a la base de datos
async function probarConexionDB() {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.execute('SELECT NOW() as hora_servidor, CURDATE() as fecha_servidor');
    console.log(`✅ [${new Date().toLocaleString('es-CO')}] Conexión a base de datos OK`);
    console.log(`🗄️ Hora del servidor de BD: ${result[0].hora_servidor}`);
    console.log(`📅 Fecha del servidor de BD: ${result[0].fecha_servidor}`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleString('es-CO')}] Error de conexión a base de datos:`, error.message);
    return false;
  }
}

// CORRECCIÓN CRÍTICA: Expresión cron corregida para ejecutar todos los días a las 8:00 AM
// Formato: segundo minuto hora día mes día_semana
// '0 0 8 * * *' significa: segundo 0, minuto 0, hora 8, cualquier día del mes, cualquier mes, cualquier día de la semana
const cronJob = cron.schedule('0 0 8 * * *', async () => {
  console.log(`🔄 [${new Date().toLocaleString('es-CO')}] Ejecutando generación automática de inventario...`);
  
  // Verificar conexión antes de ejecutar
  const conexionOK = await probarConexionDB();
  if (!conexionOK) {
    console.error(`❌ [${new Date().toLocaleString('es-CO')}] No se puede generar inventario: problema de conexión a BD`);
    return;
  }
  
  // Ejecutar generación de inventario
  const resultado = await GenerarInventarioAutomatico();
  
  if (resultado.success) {
    console.log(`🎉 [${new Date().toLocaleString('es-CO')}] Inventario automático completado exitosamente`);
  } else {
    console.error(`💥 [${new Date().toLocaleString('es-CO')}] Falló la generación automática de inventario: ${resultado.message}`);
  }
}, {
  scheduled: true,
  timezone: "America/Bogota"
});

// Función para probar el cron job (ejecutar en los próximos 30 segundos para testing)
function probarCronJob() {
  const ahora = new Date();
  const proximaEjecucion = new Date(ahora.getTime() + 30000); // 30 segundos desde ahora
  const minutos = proximaEjecucion.getMinutes();
  const segundos = proximaEjecucion.getSeconds();
  
  console.log(`🧪 [${new Date().toLocaleString('es-CO')}] Programando prueba de cron job para ${proximaEjecucion.toLocaleTimeString('es-CO')}`);
  
  // Crear un cron job de prueba que se ejecute una sola vez
  const cronPrueba = cron.schedule(`${segundos} ${minutos} * * * *`, async () => {
    console.log(`🎯 [${new Date().toLocaleString('es-CO')}] ¡PRUEBA DE CRON JOB EJECUTADA CORRECTAMENTE!`);
    await GenerarInventarioAutomatico();
    cronPrueba.destroy(); // Destruir el cron job de prueba después de ejecutarlo
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });
}

// Verificar que el cron job esté activo
if (cronJob) {
  console.log('✅ Cron job configurado exitosamente: Inventario automático todos los días a las 8:00 AM (Zona horaria: America/Bogota)');
  
  // Verificar estado al iniciar
  setTimeout(() => {
    verificarEstadoCron();
    probarConexionDB();
    
    // Opcional: Ejecutar prueba de cron job (comentar en producción)
    // probarCronJob();
  }, 2000);
  
  // Verificar estado cada hora para asegurar que el cron sigue activo
  cron.schedule('0 0 * * * *', () => {
    console.log(`💓 [${new Date().toLocaleString('es-CO')}] Sistema de inventario automático activo - Heartbeat`);
  }, {
    scheduled: true,
    timezone: "America/Bogota"
  });
  
} else {
  console.error('❌ Error: No se pudo configurar el cron job');
}

// Manejar señales del sistema para limpiar recursos
process.on('SIGINT', () => {
  console.log(`🛑 [${new Date().toLocaleString('es-CO')}] Recibida señal SIGINT, cerrando aplicación...`);
  if (cronJob) {
    cronJob.destroy();
    console.log('🗑️ Cron job detenido correctamente');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`🛑 [${new Date().toLocaleString('es-CO')}] Recibida señal SIGTERM, cerrando aplicación...`);
  if (cronJob) {
    cronJob.destroy();
    console.log('🗑️ Cron job detenido correctamente');
  }
  process.exit(0);
});

module.exports = { 
  GenerarInventario,
  GenerarInventarioAutomatico,
  verificarEstadoCron,
  probarConexionDB,
  probarCronJob  // Exportar la función de prueba
};