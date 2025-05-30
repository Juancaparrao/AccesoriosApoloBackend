const pool = require('../db');

async function ReactivarProducto(req, res) {
  const { referencia } = req.body;

  if (!referencia) {
    return res.status(400).json({
      success: false,
      mensaje: 'La referencia es obligatoria.'
    });
  }

  try {
    const [productos] = await pool.execute(
      'SELECT estado FROM producto WHERE referencia = ?',
      [referencia]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado.'
      });
    }

    if (productos[0].estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El producto ya está activo.'
      });
    }

    await pool.execute(
      'UPDATE producto SET estado = true WHERE referencia = ?',
      [referencia]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Producto reactivado exitosamente.'
    });

  } catch (error) {
    console.error('Error al reactivar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al reactivar el producto.'
    });
  }
}

module.exports = { ReactivarProducto };
