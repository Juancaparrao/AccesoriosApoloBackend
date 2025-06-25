const pool = require('../db');

async function ConsultarInventarioPorFecha(req, res) {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({
        success: false,
        mensaje: 'La fecha es requerida. Formato: YYYY-MM-DD'
      });
    }

    // Validar formato de fecha
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      return res.status(400).json({
        success: false,
        mensaje: 'Formato de fecha inválido. Use: YYYY-MM-DD'
      });
    }

    // Buscar inventarios por fecha específica
    const [inventarios] = await pool.execute(`
      SELECT
        id_inventario,
        fecha_creacion,
        cantidad_productos,
        cantidad_unidades,
        cantidad_calcomanias,        
        cantidad_unidades_calcomanias, 8
        valor_total,
        responsable
      FROM inventario
      WHERE fecha_creacion = ?
      ORDER BY id_inventario DESC
    `, [fecha]);

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

    const formatearFecha = (fecha) => {
      return new Date(fecha).toLocaleDateString('es-CO');
    };

    const inventariosFormateados = inventarios.map(inventario => ({
      id: inventario.id_inventario,
      fecha_creacion: formatearFecha(inventario.fecha_creacion),
      cantidad_productos: formatearNumero(inventario.cantidad_productos),
      cantidad_unidades: formatearNumero(inventario.cantidad_unidades),
      cantidad_calcomanias: formatearNumero(inventario.cantidad_calcomanias),        // Agregado y formateado
      cantidad_unidades_calcomanias: formatearNumero(inventario.cantidad_unidades_calcomanias), // Agregado y formateado
      valor_total: formatearMoneda(inventario.valor_total), // Usar formatearMoneda
      responsable: inventario.responsable
    }));

    return res.status(200).json({
      success: true,
      fecha_consultada: formatearFecha(fecha),
      total_inventarios: inventarios.length,
      inventarios: inventariosFormateados
    });

  } catch (error) {
    console.error('❌ Error al buscar inventarios por fecha:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al buscar inventarios por fecha.'
    });
  }
}

module.exports = { ConsultarInventarioPorFecha };
