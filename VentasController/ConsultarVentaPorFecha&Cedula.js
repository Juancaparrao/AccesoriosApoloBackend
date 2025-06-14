const pool = require('../db');

// Controlador para consultar todas las ventas/facturas con filtros opcionales
async function ConsultarVentaEspecifica(req, res) {
  try {
    // Obtener parámetros de consulta del frontend
    const { fecha, cedula } = req.query;
    
    // Construir la consulta base
    let query = `
      SELECT 
        f.id_factura,
        u.cedula,
        u.nombre as nombre_cliente,
        f.fecha_venta,
        f.metodo_pago,
        f.valor_total as total
      FROM factura f
      INNER JOIN usuario u ON f.fk_id_usuario = u.id_usuario
    `;
    
    // Array para almacenar las condiciones WHERE
    const condiciones = [];
    const parametros = [];
    
    // Filtro por cédula
    if (cedula && cedula.trim() !== '') {
      condiciones.push('u.cedula = ?');
      parametros.push(cedula.trim());
    }
    
    // Filtro por fecha específica
    if (fecha && fecha.trim() !== '') {
      condiciones.push('DATE(f.fecha_venta) = ?');
      parametros.push(fecha.trim());
    }
    
    // Agregar condiciones WHERE si existen
    if (condiciones.length > 0) {
      query += ' WHERE ' + condiciones.join(' AND ');
    }
    
    // Ordenar por fecha y ID de factura
    query += ' ORDER BY f.fecha_venta DESC, f.id_factura DESC';
    
    // Ejecutar la consulta
    const [ventas] = await pool.execute(query, parametros);

    if (ventas.length === 0) {
      return res.status(200).json({
        success: true,
        mensaje: 'No se encontraron ventas con los criterios especificados',
        filtros_aplicados: {
          cedula: cedula || null,
          fecha: fecha || null
        },
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

    // Calcular total de ventas (suma de todos los valores)
    const totalVentas = ventasFormateadas.reduce((sum, venta) => sum + venta.total, 0);

    return res.status(200).json({
      success: true,
      mensaje: `Se encontraron ${ventasFormateadas.length} ventas`,
      filtros_aplicados: {
        cedula: cedula || null,
        fecha: fecha || null
      },
      total_ventas: ventasFormateadas.length,
      total_valor_ventas: totalVentas,
      total_valor_formateado: new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
      }).format(totalVentas),
      ventas: ventasFormateadas
    });

  } catch (error) {
    console.error('Error al consultar las ventas:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al consultar las ventas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Exportar la función
module.exports = {
  ConsultarVentaEspecifica
};