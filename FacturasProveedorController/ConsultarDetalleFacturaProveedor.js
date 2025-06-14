const pool = require('../db');

async function ConsultarDetalleFacturaProveedor(req, res) {
  try {
    const { id_factura_proveedor } = req.params;

    // Validar que el ID de factura esté presente
    if (!id_factura_proveedor) {
      return res.status(400).json({
        success: false,
        mensaje: 'El ID de factura de proveedor es requerido'
      });
    }

    // Consultar información básica de la factura de proveedor
    const [factura] = await pool.execute(
      `SELECT 
        fp.id_factura_proveedor,
        fp.fecha_compra,
        fp.metodo_pago,
        fp.valor_total,
        p.nit,
        p.nombre AS nombre_proveedor,
        p.empresa,
        p.telefono AS telefono_proveedor,
        p.direccion
      FROM factura_proveedor fp
      JOIN proveedor p ON fp.nit_proveedor = p.nit
      WHERE fp.id_factura_proveedor = ?`,
      [id_factura_proveedor]
    );

    // Si no se encuentra la factura
    if (factura.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Factura de proveedor no encontrada'
      });
    }

    // Consultar detalles de la factura con información de productos
    const [detalles] = await pool.execute(
      `SELECT 
        df.FK_referencia AS referencia,
        pr.nombre AS nombre_producto,
        df.cantidad,
        df.precio_unitario,
        (df.cantidad * df.precio_unitario) AS subtotal
      FROM detalle_factura_proveedor df
      JOIN producto pr ON df.FK_referencia = pr.referencia
      WHERE df.FK_id_factura_proveedor = ?`,
      [id_factura_proveedor]
    );

    // Formatear respuesta
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

    const respuesta = {
      factura: {
        id: factura[0].id_factura_proveedor,
        fecha_compra: formatearFecha(factura[0].fecha_compra),
        metodo_pago: factura[0].metodo_pago,
        valor_total: formatearNumero(factura[0].valor_total),
        proveedor: {
          nit: factura[0].nit,
          nombre: factura[0].nombre_proveedor,
          empresa: factura[0].empresa,
          telefono: factura[0].telefono_proveedor,
          direccion: factura[0].direccion
        }
      },
      productos: detalles.map(item => {
        const precioUnitario = Number(item.precio_unitario);
        const cantidad = Number(item.cantidad);
        const subtotal = cantidad * precioUnitario;

        return {
          referencia: item.referencia,
          nombre: item.nombre_producto,
          cantidad: cantidad,
          precio_unitario: formatearNumero(precioUnitario),
          subtotal: formatearNumero(subtotal)
        };
      })

    };

    return res.status(200).json({
      success: true,
      data: respuesta
    });

  } catch (error) {
    console.error('Error al consultar detalle de factura de proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al consultar el detalle de la factura de proveedor'
    });
  }
}

module.exports = {
  ConsultarDetalleFacturaProveedor
};