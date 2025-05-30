const pool = require('../db');

async function ObtenerProductos(req, res) {
  try {
    const [productos] = await pool.execute(`
      SELECT 
        p.referencia, 
        p.nombre, 
        p.descripcion, 
        p.talla, 
        p.stock, 
        p.url_archivo, 
        p.precio_unidad, 
        p.descuento, 
        p.precio_descuento, 
        p.estado,
        c.nombre AS categoria,
        s.nombre AS subcategoria
      FROM producto p
      JOIN categoria c ON p.FK_id_categoria = c.id_categoria
      JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
    `);

    const productosFormateados = productos.map(producto => ({
      referencia: producto.referencia,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      talla: producto.talla,
      stock: producto.stock,
      url_archivo: producto.url_archivo,
      precio_unidad: producto.precio_unidad,
      descuento: producto.descuento,
      precio_descuento: producto.precio_descuento,
      categoria: producto.categoria,
      subcategoria: producto.subcategoria,
      estado: producto.estado ? 'Activo' : 'Inactivo'
    }));

    return res.status(200).json({
      success: true,
      productos: productosFormateados
    });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener los productos'
    });
  }
}

const pool = require('../db');

async function ActualizarProducto(req, res) {
  const {
    referencia,
    nombre,
    descripcion,
    talla,
    precio_unidad,
    descuento,
    FK_id_categoria,
    FK_id_subcategoria,
    estado
  } = req.body;

  const archivos = req.files; // array de imágenes

  try {
    const [productoExistente] = await pool.execute(
      'SELECT * FROM producto WHERE referencia = ?',
      [referencia]
    );

    if (productoExistente.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'Producto no encontrado'
      });
    }

    const precioDesc = precio_unidad - (precio_unidad * (descuento / 100));

    await pool.execute(
      `UPDATE producto 
       SET nombre = ?, descripcion = ?, talla = ?, 
           precio_unidad = ?, descuento = ?, precio_descuento = ?, 
           FK_id_categoria = ?, FK_id_subcategoria = ?, estado = ?
       WHERE referencia = ?`,
      [
        nombre,
        descripcion,
        talla,
        precio_unidad,
        descuento,
        precioDesc,
        FK_id_categoria,
        FK_id_subcategoria,
        estado,
        referencia
      ]
    );

    // Guardar nuevas imágenes si vienen archivos
    if (archivos && archivos.length > 0) {
      for (const file of archivos) {
        const url = file.path;
        await pool.execute(
          `INSERT INTO producto_imagen (FK_referencia_producto, url_imagen) VALUES (?, ?)`,
          [referencia, url]
        );
      }
    }

    return res.status(200).json({
      success: true,
      mensaje: 'Producto actualizado correctamente.'
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar el producto'
    });
  }
}


module.exports = { ActualizarProducto, ObtenerProductos };
