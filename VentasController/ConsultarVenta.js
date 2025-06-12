const pool = require('../db');

// Controlador para consultar todas las ventas/facturas
async function ConsultarVenta(req, res) {
  try {
    // Query simplificado que toma el valor_total directamente de la tabla factura
    const [ventas] = await pool.execute(`
      SELECT 
        f.id_factura,
        u.cedula,
        u.nombre as nombre_cliente,
        f.fecha_venta,
        f.metodo_pago,
        f.valor_total as total
      FROM factura f
      INNER JOIN usuario u ON f.fk_id_usuario = u.id_usuario
      ORDER BY f.fecha_venta DESC, f.id_factura DESC
    `);

    if (ventas.length === 0) {
      return res.status(200).json({
        success: true,
        mensaje: 'No se encontraron ventas registradas',
        total_ventas: 0,
        ventas: []
      });
    }

    // Formatear los datos para una mejor presentación
    const ventasFormateadas = ventas.map(venta => ({
      id_factura: venta.id_factura,
      cedula: venta.cedula,
      nombre_cliente: venta.nombre_cliente,
      fecha_compra: new Date(venta.fecha_venta).toLocaleDateString('es-CO'),
      fecha_compra_iso: venta.fecha_venta, // Para ordenamiento o filtros
      total: parseFloat(venta.total),
      total_formateado: new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
      }).format(venta.total),
      metodo_pago: venta.metodo_pago
    }));

    return res.status(200).json({
      success: true,
      mensaje: `Se encontraron ${ventasFormateadas.length} ventas`,
      total_ventas: ventasFormateadas.length,
      ventas: ventasFormateadas
    });

  } catch (error) {
    console.error('Error al consultar las ventas:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al consultar las ventas'
    });
  }
}

// Exportar la función
module.exports = {
  ConsultarVenta
};