const pool = require('../db');

async function ConsultarProveedor(req, res) {
  try {
    const [proveedores] = await pool.execute(`
      SELECT nit, nombre AS representante, empresa AS nombreEmpresa, correo, telefono, direccion, estado
      FROM proveedor
    `);

    return res.status(200).json({
      success: true,
      proveedores: proveedores
    });

  } catch (error) {
    console.error('Error al consultar proveedores:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener la lista de proveedores.'
    });
  }
}

module.exports = { ConsultarProveedor };
