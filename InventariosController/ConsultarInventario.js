const pool = require('../db');

async function ConsultarInventario(req, res) {
  try {
    const [inventarios] = await pool.execute(`
      SELECT
        id_inventario,
        fecha_creacion,
        cantidad_productos,
        cantidad_unidades,
        cantidad_calcomanias,       
        cantidad_unidades_calcomanias, 
        valor_total,
        responsable
      FROM inventario
      ORDER BY fecha_creacion DESC
    `);

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
      inventarios: inventariosFormateados
    });

  } catch (error) {
    console.error('❌ Error al consultar inventarios:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de inventarios.'
    });
  }
}

module.exports = { ConsultarInventario };
