const pool = require('../db');

async function ReactivarProveedor(req, res) {
  const { nit } = req.body;

  if (!nit) {
    return res.status(400).json({
      success: false,
      mensaje: 'El NIT es obligatorio.'
    });
  }

  try {
    // Verificar si el proveedor existe y está inactivo
    const [proveedores] = await pool.execute(
      'SELECT estado FROM proveedor WHERE nit = ?',
      [nit]
    );

    if (proveedores.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Proveedor no encontrado.'
      });
    }

    const proveedor = proveedores[0];

    if (proveedor.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El proveedor ya está activo.'
      });
    }

    // Reactivar proveedor (estado = true)
    await pool.execute(
      'UPDATE proveedor SET estado = true WHERE nit = ?',
      [nit]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Proveedor reactivado exitosamente.'
    });

  } catch (error) {
    console.error('Error al reactivar proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al reactivar el proveedor.'
    });
  }
}

module.exports = { ReactivarProveedor };
