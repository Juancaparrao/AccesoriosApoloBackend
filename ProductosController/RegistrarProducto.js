const pool = require('../db');
const cloudinary = require('../cloudinary');

// Registrar Producto
async function RegistrarProducto(req, res) {
  try {
    const {
      referencia,
      nombre,
      descripcion,
      talla,
      precio_unidad,
      descuento,
      FK_id_categoria,
      FK_id_subcategoria
    } = req.body;

    if (!referencia || !nombre || !precio_unidad || descuento === undefined || !FK_id_categoria || !FK_id_subcategoria) {
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
    if (req.file?.path) {
      const subida = await cloudinary.uploader.upload(req.file.path, {
        folder: 'productos'
      });
      url_archivo = subida.secure_url;
    }

    const precio_descuento = parseFloat(precio_unidad - (precio_unidad * (descuento / 100))).toFixed(2);

    await pool.execute(
      `INSERT INTO producto 
       (referencia, nombre, descripcion, talla, stock, url_archivo, precio_unidad, descuento, precio_descuento, FK_id_categoria, FK_id_subcategoria, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        referencia,
        nombre,
        descripcion || null,
        talla || null,
        0,
        url_archivo,
        precio_unidad,
        descuento,
        precio_descuento,
        FK_id_categoria,
        FK_id_subcategoria,
        1
      ]
    );

    return res.status(201).json({
      success: true,
      mensaje: 'Producto registrado exitosamente.',
      producto: {
        referencia,
        nombre,
        precio_unidad,
        descuento,
        precio_descuento
      }
    });

  } catch (error) {
    console.error('❌ Error al registrar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al registrar el producto.'
    });
  }
}

// Obtener todas las categorías activas
async function ObtenerCategorias(req, res) {
  try {
    const [categorias] = await pool.execute(`
      SELECT id_categoria, nombre_categoria 
      FROM categoria 
      WHERE estado = 1
    `);

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

// Obtener subcategorías activas por ID de categoría
async function ObtenerSubcategoriasPorCategoria(req, res) {
  const { id_categoria } = req.params;

  try {
    const [subcategorias] = await pool.execute(`
      SELECT id_subcategoria, nombre_subcategoria 
      FROM subcategoria 
      WHERE FK_id_categoria = ? AND estado = 1
    `, [id_categoria]);

    return res.status(200).json({
      success: true,
      subcategorias
    });

  } catch (error) {
    console.error('❌ Error al obtener subcategorías:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al obtener subcategorías.'
    });
  }
}

module.exports = {
  RegistrarProducto,
  ObtenerCategorias,
  ObtenerSubcategoriasPorCategoria
};
