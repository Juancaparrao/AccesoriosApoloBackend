const pool = require('../db'); // Asume que db.js configura tu pool de conexiones a la base de datos
const jwt = require('jsonwebtoken'); // Para verificar tokens JWT
const cron = require('node-cron'); // Para programar tareas cron

// Función para generar inventario (manual o automático)
async function GenerarInventario(req, res) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction(); // Inicia una transacción de base de datos

    // Determinar el responsable (manual vs automático)
    let responsable = 'Sistema';
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verifica el token JWT
        responsable = decoded.nombre || 'Usuario';
      } catch (tokenError) {
        console.log('Token inválido, usando Sistema como responsable');
      }
    }

    // 1. Obtener todos los productos activos con stock
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

    // 2. Obtener todas las calcomanías activas con stock
    const [calcomanias] = await connection.execute(`
      SELECT
        id_calcomania,
        nombre,
        stock_pequeno,
        stock_mediano,
        stock_grande,
        precio_unidad,
        precio_descuento
      FROM calcomania
      WHERE estado = 1 AND (stock_pequeno > 0 OR stock_mediano > 0 OR stock_grande > 0)
      ORDER BY nombre
    `);

    if (productos.length === 0 && calcomanias.length === 0) {
      await connection.rollback(); // Revierte la transacción si no hay productos ni calcomanías
      return res.status(400).json({
        success: false,
        mensaje: 'No hay productos ni calcomanías disponibles para generar inventario.'
      });
    }

    // 3. Calcular totales combinados
    const cantidad_productos_reales = productos.length;
    const cantidad_calcomanias_reales = calcomanias.length;

    const cantidad_unidades_productos = productos.reduce((total, p) => total + p.stock, 0);
    const cantidad_unidades_calcomanias = calcomanias.reduce((total, c) => total + c.stock_pequeno + c.stock_mediano + c.stock_grande, 0);

    const cantidad_productos_inventario = cantidad_productos_reales; // Conteo de ítems de tipo producto
    const cantidad_calcomanias_inventario = cantidad_calcomanias_reales; // Conteo de ítems de tipo calcomanía

    const cantidad_unidades_total = cantidad_unidades_productos + cantidad_unidades_calcomanias;

    let valor_total_inventario = 0;

    // 4. Crear registro principal de inventario
    const [inventarioResult] = await connection.execute(`
      INSERT INTO inventario (fecha_creacion, cantidad_productos, cantidad_unidades, cantidad_calcomanias, cantidad_unidades_calcomanias, valor_total, responsable)
      VALUES (CURDATE(), ?, ?, ?, ?, 0, ?)
    `, [
      cantidad_productos_inventario,
      cantidad_unidades_productos, // Unidades de productos
      cantidad_calcomanias_inventario,
      cantidad_unidades_calcomanias, // Unidades de calcomanías
      responsable
    ]);

    const id_inventario = inventarioResult.insertId;

    // 5. Insertar detalles de productos y calcular valor total
    for (const producto of productos) {
      const subtotal = producto.stock * producto.precio_unidad;
      valor_total_inventario += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario
        (FK_id_inventario, FK_referencia_producto, cantidad, precio_unitario, stock_general, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id_inventario, producto.referencia, producto.stock, producto.precio_unidad, producto.stock, subtotal]);
    }

    // 6. Insertar detalles de calcomanías y calcular valor total
    for (const calcomania of calcomanias) {
      const stock_general_calcomania = calcomania.stock_pequeno + calcomania.stock_mediano + calcomania.stock_grande;
      // Usar precio_descuento si existe, de lo contrario precio_unidad
      const precio_a_usar = calcomania.precio_descuento !== null && calcomania.precio_descuento !== undefined ? calcomania.precio_descuento : calcomania.precio_unidad;
      const subtotal = stock_general_calcomania * precio_a_usar;
      valor_total_inventario += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario
        (FK_id_inventario, FK_id_calcomania, cantidad, precio_unitario, stock_pequeno, stock_mediano, stock_grande, stock_general, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id_inventario,
        calcomania.id_calcomania,
        stock_general_calcomania,
        precio_a_usar,
        calcomania.stock_pequeno,
        calcomania.stock_mediano,
        calcomania.stock_grande,
        stock_general_calcomania,
        subtotal
      ]);
    }

    // 7. Actualizar el valor total en la tabla inventario
    await connection.execute(`
      UPDATE inventario
      SET valor_total = ?
      WHERE id_inventario = ?
    `, [valor_total_inventario, id_inventario]);

    await connection.commit(); // Confirma la transacción

    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(valor));
    };

    return res.status(201).json({
      success: true,
      mensaje: 'Inventario generado exitosamente (Productos y Calcomanías).',
      inventario: {
        id: id_inventario,
        fecha_creacion: new Date().toLocaleDateString('es-CO'),
        cantidad_productos: formatearNumero(cantidad_productos_inventario),
        cantidad_unidades_productos: formatearNumero(cantidad_unidades_productos),
        cantidad_calcomanias: formatearNumero(cantidad_calcomanias_inventario),
        cantidad_unidades_calcomanias: formatearNumero(cantidad_unidades_calcomanias),
        valor_total: formatearMoneda(valor_total_inventario),
        responsable: responsable
      }
    });

  } catch (error) {
    await connection.rollback(); // Revierte la transacción en caso de error
    console.error('❌ Error al generar inventario:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al generar el inventario.'
    });
  } finally {
    connection.release(); // Libera la conexión de la base de datos
  }
}

// Función para generar inventario automáticamente (sin response directo a cliente)
async function GenerarInventarioAutomatico() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction(); // Inicia una transacción de base de datos

    console.log(`🕐 [${new Date().toLocaleString('es-CO')}] Iniciando generación automática de inventario...`);

    // 1. Obtener todos los productos activos con stock
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

    // 2. Obtener todas las calcomanías activas con stock
    const [calcomanias] = await connection.execute(`
      SELECT
        id_calcomania,
        nombre,
        stock_pequeno,
        stock_mediano,
        stock_grande,
        precio_unidad,
        precio_descuento
      FROM calcomania
      WHERE estado = 1 AND (stock_pequeno > 0 OR stock_mediano > 0 OR stock_grande > 0)
      ORDER BY nombre
    `);

    if (productos.length === 0 && calcomanias.length === 0) {
      console.log(`⚠️ [${new Date().toLocaleString('es-CO')}] No hay productos ni calcomanías disponibles para generar inventario automático.`);
      await connection.rollback(); // Revierte la transacción
      return { success: false, message: 'No hay productos ni calcomanías disponibles' };
    }

    // 3. Calcular totales combinados
    const cantidad_productos_reales = productos.length;
    const cantidad_calcomanias_reales = calcomanias.length;

    const cantidad_unidades_productos = productos.reduce((total, p) => total + p.stock, 0);
    const cantidad_unidades_calcomanias = calcomanias.reduce((total, c) => total + c.stock_pequeno + c.stock_mediano + c.stock_grande, 0);

    const cantidad_productos_inventario = cantidad_productos_reales;
    const cantidad_calcomanias_inventario = cantidad_calcomanias_reales;

    const cantidad_unidades_total = cantidad_unidades_productos + cantidad_unidades_calcomanias;

    let valor_total_inventario = 0;

    // 4. Crear registro principal de inventario
    const [inventarioResult] = await connection.execute(`
      INSERT INTO inventario (fecha_creacion, cantidad_productos, cantidad_unidades, cantidad_calcomanias, cantidad_unidades_calcomanias, valor_total, responsable)
      VALUES (NOW(), ?, ?, ?, ?, 0, 'Sistema')
    `, [
      cantidad_productos_inventario,
      cantidad_unidades_productos,
      cantidad_calcomanias_inventario,
      cantidad_unidades_calcomanias
    ]);

    const id_inventario = inventarioResult.insertId;

    // 5. Insertar detalles de productos y calcular valor total
    for (const producto of productos) {
      const subtotal = producto.stock * producto.precio_unidad;
      valor_total_inventario += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario
        (FK_id_inventario, FK_referencia_producto, cantidad, precio_unitario, stock_general, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id_inventario, producto.referencia, producto.stock, producto.precio_unidad, producto.stock, subtotal]);
    }

    // 6. Insertar detalles de calcomanías y calcular valor total
    for (const calcomania of calcomanias) {
      const stock_general_calcomania = calcomania.stock_pequeno + calcomania.stock_mediano + calcomania.stock_grande;
      const precio_a_usar = calcomania.precio_descuento !== null && calcomania.precio_descuento !== undefined ? calcomania.precio_descuento : calcomania.precio_unidad;
      const subtotal = stock_general_calcomania * precio_a_usar;
      valor_total_inventario += subtotal;

      await connection.execute(`
        INSERT INTO detalle_inventario
        (FK_id_inventario, FK_id_calcomania, cantidad, precio_unitario, stock_pequeno, stock_mediano, stock_grande, stock_general, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id_inventario,
        calcomania.id_calcomania,
        stock_general_calcomania,
        precio_a_usar,
        calcomania.stock_pequeno,
        calcomania.stock_mediano,
        calcomania.stock_grande,
        stock_general_calcomania,
        subtotal
      ]);
    }

    // 7. Actualizar el valor total en la tabla inventario
    await connection.execute(`
      UPDATE inventario
      SET valor_total = ?
      WHERE id_inventario = ?
    `, [valor_total_inventario, id_inventario]);

    await connection.commit(); // Confirma la transacción

    const mensaje = `✅ [${new Date().toLocaleString('es-CO')}] Inventario automático completado exitosamente - ID: ${id_inventario}`;
    const estadisticas = `📊 Ítems Productos: ${cantidad_productos_inventario.toLocaleString('es-CO')}, Unidades Productos: ${cantidad_unidades_productos.toLocaleString('es-CO')}, Ítems Calcomanías: ${cantidad_calcomanias_inventario.toLocaleString('es-CO')}, Unidades Calcomanías: ${cantidad_unidades_calcomanias.toLocaleString('es-CO')}, Valor Total: $${valor_total_inventario.toLocaleString('es-CO')}`;

    console.log(mensaje);
    console.log(estadisticas);

    return {
      success: true,
      message: 'Inventario generado exitosamente (Productos y Calcomanías).',
      data: {
        id: id_inventario,
        cantidad_productos: cantidad_productos_inventario,
        cantidad_unidades_productos: cantidad_unidades_productos,
        cantidad_calcomanias: cantidad_calcomanias_inventario,
        cantidad_unidades_calcomanias: cantidad_unidades_calcomanias,
        valor_total: valor_total_inventario
      }
    };

  } catch (error) {
    await connection.rollback(); // Revierte la transacción en caso de error
    const errorMsg = `❌ [${new Date().toLocaleString('es-CO')}] Error al generar inventario automático: ${error.message}`;
    console.error(errorMsg);
    console.error('Stack trace:', error.stack);
    return { success: false, message: error.message };
  } finally {
    connection.release(); // Libera la conexión de la base de datos
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

// Verificar que el cron job esté activo
if (cronJob) {
  console.log('✅ Cron job configurado exitosamente: Inventario automático todos los días a las 8:00 AM (Zona horaria: America/Bogota)');

  // Verificar estado al iniciar
  setTimeout(() => {
    verificarEstadoCron();
    probarConexionDB();

    // Habilitado para la prueba de 30 segundos
    probarCronJob();
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
  GenerarInventarioAutomatico
};
