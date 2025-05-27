const pool = require('../db');

async function RegistrarProveedor(req, res) {
  try {
    const { nit, representante, nombreEmpresa, correo, telefono, direccion } = req.body;

    if (!nit || !representante || !nombreEmpresa || !correo || !telefono || !direccion) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios.'
      });
    }

    // Verificar si el proveedor ya está registrado
    const [proveedores] = await pool.execute(
      'SELECT nit FROM proveedor WHERE nit = ? OR correo = ?',
      [nit, correo]
    );

    if (proveedores.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Este proveedor ya está registrado.'
      });
    }

    await pool.execute(
      'INSERT INTO proveedor (nit, nombre, empresa, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)',
      [nit, representante, nombreEmpresa, correo, telefono, direccion]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Proveedor registrado exitosamente.'
    });

  } catch (error) {
    console.error('Error al registrar proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar el proveedor.'
    });
  }
}

module.exports = { RegistrarProveedor };
