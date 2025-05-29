const pool = require('../db');
const cloudinary = require('../cloudinary');

async function ObtenerDatosSubcategoria(req, res) {
  const { id_subcategoria } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT s.id_subcategoria, s.nombre_subcategoria, s.descripcion, s.descuento,
              s.url_imagen, s.FK_id_categoria, c.nombre_categoria
       FROM subcategoria s
       JOIN categoria c ON s.FK_id_categoria = c.id_categoria
       WHERE s.id_subcategoria = ?`,
      [id_subcategoria]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Subcategoría no encontrada.'
      });
    }

    return res.status(200).json({
      success: true,
      subcategoria: rows[0]
    });

  } catch (error) {
    console.error('❌ Error al obtener datos de la subcategoría:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener los datos de la subcategoría.'
    });
  }
}

async function ActualizarSubcategoria(req, res) {
  try {
    const { id_subcategoria, nombre_subcategoria, descripcion, descuento, FK_id_categoria } = req.body;

    if (!id_subcategoria) {
      return res.status(400).json({ success: false, mensaje: 'El ID de subcategoría es requerido.' });
    }

    const [resultado] = await pool.execute(`
      SELECT * FROM subcategoria WHERE id_subcategoria = ?
    `, [id_subcategoria]);

    if (resultado.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Subcategoría no encontrada.' });
    }

    const subcategoriaActual = resultado[0];
    let url_imagen = subcategoriaActual.url_imagen;

    // Si viene una imagen nueva, la sube a Cloudinary
    if (req.file?.path) {
      const subida = await cloudinary.uploader.upload(req.file.path, {
        folder: 'subcategorias'
      });
      url_imagen = subida.secure_url;
    }

    await pool.execute(`
      UPDATE subcategoria 
      SET nombre_subcategoria = ?, descripcion = ?, descuento = ?, url_imagen = ?, FK_id_categoria = ?
      WHERE id_subcategoria = ?
    `, [
      nombre_subcategoria || subcategoriaActual.nombre_subcategoria,
      descripcion || subcategoriaActual.descripcion,
      descuento !== undefined ? descuento : subcategoriaActual.descuento,
      url_imagen,
      FK_id_categoria || subcategoriaActual.FK_id_categoria,
      id_subcategoria
    ]);

    return res.status(200).json({
      success: true,
      mensaje: 'Subcategoría actualizada correctamente.',
      imagen: url_imagen
    });

  } catch (error) {
    console.error('Error al actualizar subcategoría:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
}

module.exports = { ActualizarSubcategoria, ObtenerDatosSubcategoria };
