const pool = require('../db');

async function EliminarProveedor(req, res) {
  const { nit } = req.body;

  if (!nit) {
    return res.status(400).json({
      success: false,
      mensaje: 'El NIT es obligatorio.'
    });
  }

  try {
    // Verificar que el proveedor existe y está activo
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

    if (!proveedor.estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'El proveedor ya está inactivo.'
      });
    }

    // Cambiar estado a inactivo (false)
    await pool.execute(
      'UPDATE proveedor SET estado = false WHERE nit = ?',
      [nit]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Proveedor desactivado exitosamente.'
    });

  } catch (error) {
    console.error('Error al desactivar proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al desactivar el proveedor.'
    });
  }
}

module.exports = { EliminarProveedor };
