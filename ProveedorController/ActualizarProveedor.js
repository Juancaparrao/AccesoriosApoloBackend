const pool = require('../db');

async function ObtenerDatosProveedor(req, res) {
  try {
    const { nit } = req.body;

    const [rows] = await pool.execute(
      `SELECT nit, nombre AS representante, empresa AS nombreEmpresa, correo, telefono, direccion
       FROM proveedor
       WHERE nit = ?`,
      [nit]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Proveedor no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      proveedor: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener datos del proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos del proveedor.'
    });
  }
}

async function ActualizarProveedor(req, res) {
  const {
    nitOriginal,
    nit,
    representante,
    nombreEmpresa,
    correo,
    telefono,
    direccion
  } = req.body;

  try {
    // Verificar existencia del proveedor original
    const [proveedores] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE nit = ?',
      [nitOriginal]
    );

    if (proveedores.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Proveedor no encontrado.'
      });
    }

    const id_proveedor = proveedores[0].id_proveedor;

    // Validaciones de duplicados
    const [nitExiste] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE nit = ? AND id_proveedor != ?',
      [nit, id_proveedor]
    );

    const [correoExiste] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE correo = ? AND id_proveedor != ?',
      [correo, id_proveedor]
    );

    const [telefonoExiste] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE telefono = ? AND id_proveedor != ?',
      [telefono, id_proveedor]
    );

    const [empresaExiste] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE empresa = ? AND id_proveedor != ?',
      [nombreEmpresa, id_proveedor]
    );

    const [direccionExiste] = await pool.execute(
      'SELECT id_proveedor FROM proveedor WHERE direccion = ? AND id_proveedor != ?',
      [direccion, id_proveedor]
    );

    if (nitExiste.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese NIT ya está en uso.' });
    }

    if (correoExiste.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese correo ya está en uso.' });
    }

    if (telefonoExiste.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese teléfono ya está en uso.' });
    }

    if (empresaExiste.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Ese nombre de empresa ya existe.' });
    }

    if (direccionExiste.length > 0) {
      return res.status(409).json({ success: false, mensaje: 'Esa dirección ya está registrada.' });
    }

    // Actualizar datos
    await pool.execute(
      `UPDATE proveedor
       SET nit = ?, nombre = ?, empresa = ?, correo = ?, telefono = ?, direccion = ?
       WHERE id_proveedor = ?`,
      [nit, representante, nombreEmpresa, correo, telefono, direccion, id_proveedor]
    );

    return res.status(200).json({
      success: true,
      mensaje: 'Proveedor actualizado correctamente.'
    });

  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al actualizar el proveedor.'
    });
  }
}

module.exports = { ObtenerDatosProveedor, ActualizarProveedor };
