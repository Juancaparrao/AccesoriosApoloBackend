const pool = require('../db');

async function ConsultarDetalleVenta(req, res) {
  const { id_factura } = req.params;

  try {
    const [ventas] = await pool.execute(`
      SELECT 
        f.id_factura,
        f.fecha_venta,
        f.metodo_pago,
        f.valor_total,
        u.cedula AS cedula_cliente,
        u.nombre AS nombre_cliente,
        u.correo AS correo_cliente,
        u.telefono AS telefono_cliente,
        df.FK_referencia AS referencia_producto,
        p.nombre AS nombre_producto,
        p.precio_descuento,
        df.cantidad,
        p.precio_unidad   
      FROM factura f
      JOIN usuario u ON f.fk_id_usuario = u.id_usuario
      JOIN detalle_factura df ON df.fk_id_factura = f.id_factura
      JOIN producto p ON p.referencia = df.fk_referencia
      WHERE f.id_factura = ?
    `, [id_factura]);

    if (ventas.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró la venta con ese ID'
      });
    }

    const formatearNumero = (valor) => new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor);

    const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const venta = {
      id: ventas[0].id_factura,
      fecha_venta: formatearFecha(ventas[0].fecha_venta),
      metodo_pago: ventas[0].metodo_pago,
      valor_total: formatearNumero(ventas[0].valor_total),
      cliente: {
        cedula: ventas[0].cedula_cliente,
        nombre: ventas[0].nombre_cliente,
        correo: ventas[0].correo_cliente,
        telefono: ventas[0].telefono_cliente
      },
      productos: ventas.map(v => ({
        referencia: v.referencia_producto,
        nombre: v.nombre_producto,
        cantidad: Number(v.cantidad),
        precio_unitario: formatearNumero(v.precio_unidad),
        precio_descuento: v.precio_descuento ? formatearNumero(v.precio_descuento) : null 
      }))
    };

    return res.status(200).json({
      success: true,
      data: venta
    });

  } catch (error) {
    console.error('Error al consultar detalle de venta:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al consultar el detalle de la venta'
    });
  }
}

module.exports = {
  ConsultarDetalleVenta
};