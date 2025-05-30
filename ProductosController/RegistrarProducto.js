const pool = require('../db');

async function RegistrarProducto(req, res) {
  try {
    const {
      referencia,
      nombre,
      descripcion,
      talla,
      precio_unidad,
      FK_id_categoria,
      FK_id_subcategoria
    } = req.body;

    if (!referencia || !nombre || !precio_unidad || !FK_id_categoria || !FK_id_subcategoria) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios.'
      });
    }

    const [existe] = await pool.execute(
      'SELECT referencia FROM producto WHERE referencia = ?',
      [referencia]
    );

    if (existe.length > 0) {
      return res.status(409).json({
        success: false,
        mensaje: 'Ya existe un producto con esa referencia.'
      });
    }

    let url_archivo = null;

    // Si viene una imagen, podrías subirla a Cloudinary aquí
    if (req.file?.path) {
      const cloudinary = require('../cloudinary');
      const subida = await cloudinary.uploader.upload(req.file.path, {
        folder: 'productos'
      });
      url_archivo = subida.secure_url;
    }

    await pool.execute(
      `INSERT INTO producto 
       (referencia, nombre, descripcion, talla, precio_unidad, url_archivo, FK_id_categoria, FK_id_subcategoria, stock, descuento, precio_descuento, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        referencia,
        nombre,
        descripcion || null,
        talla || null,
        precio_unidad,
        url_archivo,
        FK_id_categoria,
        FK_id_subcategoria,
        0,          // stock por defecto
        0,          // descuento por defecto
        0,          // precio descuento por defecto
        1           // estado activo
      ]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Producto registrado exitosamente.'
    });

  } catch (error) {
    console.error('❌ Error al registrar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar el producto.'
    });
  }
}

async function ObtenerCategorias(req, res) {
  try {
    const [categorias] = await pool.execute(
      `SELECT id_categoria, nombre_categoria FROM categoria WHERE estado = 1`
    );

    return res.status(200).json({
      success: true,
      categorias
    });
  } catch (error) {
    console.error('❌ Error al obtener categorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener las categorías.'
    });
  }
}

async function ObtenerSubcategoriasPorCategoria(req, res) {
  const { id_categoria } = req.params;

  try {
    const [subcategorias] = await pool.execute(
      `SELECT id_subcategoria, nombre_subcategoria 
       FROM subcategoria 
       WHERE FK_id_categoria = ? AND estado = 1`,
      [id_categoria]
    );

    return res.status(200).json({
      success: true,
      subcategorias
    });
  } catch (error) {
    console.error('❌ Error al obtener subcategorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener las subcategorías.'
    });
  }
}

module.exports = {
  RegistrarProducto,
  ObtenerCategorias,
  ObtenerSubcategoriasPorCategoria
};
