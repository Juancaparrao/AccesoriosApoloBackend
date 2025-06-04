const pool = require('../db');

async function ConsultarFacturasProveedor(req, res) {
  try {
    const [facturas] = await pool.execute(`
      SELECT 
        fp.id_factura_proveedor AS id,
        fp.nit_proveedor AS nit,
        p.nombre,
        fp.fecha_compra AS fecha,
        fp.valor_total,
        fp.metodo_pago
      FROM factura_proveedor fp
      JOIN proveedor p ON fp.nit_proveedor = p.nit
      ORDER BY fp.fecha_compra DESC
    `);

    const formatearNumero = (valor) => {
      return new Intl.NumberFormat('es-CO').format(Number(valor));
    };

    const formatearFecha = (fecha) => {
      return new Date(fecha).toLocaleDateString('es-CO');
    };

    const facturasFormateadas = facturas.map(f => ({
      id: f.id,
      nit: f.nit,
      nombre: f.nombre,
      fecha: formatearFecha(f.fecha),
      valor_total: formatearNumero(f.valor_total),
      metodo_pago: f.metodo_pago
    }));

    return res.status(200).json({
      success: true,
      facturas: facturasFormateadas
    });

  } catch (error) {
    console.error('❌ Error al consultar facturas de proveedores:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de facturas de proveedores.'
    });
  }
}

module.exports = { ConsultarFacturasProveedor };