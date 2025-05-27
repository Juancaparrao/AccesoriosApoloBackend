const pool = require('../db');

async function BuscarProveedorPorNit(req, res) {
  try {
    const { filtro } = req.query;

    if (!filtro || filtro.trim() === '') {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar un filtro para buscar.'
      });
    }

    const [proveedores] = await pool.execute(
      `SELECT nit, nombre AS representante, empresa AS nombreEmpresa, correo, telefono, direccion, estado
       FROM proveedor
       WHERE nit LIKE ?`,
      [`${filtro}%`]
    );

    const resultados = proveedores.map(proveedor => ({
      nit: proveedor.nit,
      representante: proveedor.representante,
      nombreEmpresa: proveedor.nombreEmpresa,
      correo: proveedor.correo,
      telefono: proveedor.telefono,
      direccion: proveedor.direccion,
      estado: proveedor.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      proveedores: resultados
    });

  } catch (error) {
    console.error('Error al buscar proveedores por NIT:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al buscar proveedores.'
    });
  }
}

module.exports = { BuscarProveedorPorNit };
