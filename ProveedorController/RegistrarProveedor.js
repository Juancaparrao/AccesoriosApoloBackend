const pool = require('../db');

async function RegistrarProveedor(req, res) {
  try {
    const { nit, representante, nombreEmpresa, correo, telefono, direccion } = req.body;

    // Validación de campos obligatorios
    if (!nit || !representante || !nombreEmpresa || !correo || !telefono || !direccion) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios.'
      });
    }

    // Verificar si ya existe un proveedor con los mismos datos
    const [existente] = await pool.execute(
      `SELECT * FROM proveedor 
       WHERE nit = ? OR correo = ? OR telefono = ? OR empresa = ? OR direccion = ?`,
      [nit, correo, telefono, nombreEmpresa, direccion]
    );

    if (existente.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe un proveedor con el mismo NIT, correo, teléfono, empresa o dirección.'
      });
    }

    // Insertar proveedor con estado = 1 (activo)
    await pool.execute(
      `INSERT INTO proveedor (nit, nombre, empresa, correo, telefono, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nit, representante, nombreEmpresa, correo, telefono, direccion, 1]
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
