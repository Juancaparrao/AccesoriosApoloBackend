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
        p.precio_unidad, 
        p.descuento, 
        p.precio_descuento, 
        c.nombre AS categoria,
        s.nombre AS subcategoria,
        GROUP_CONCAT(pi.url_imagen) AS imagenes
      FROM producto p
      JOIN categoria c ON p.FK_id_categoria = c.id_categoria
      JOIN subcategoria s ON p.FK_id_subcategoria = s.id_subcategoria
      LEFT JOIN producto_imagen pi ON pi.FK_referencia_producto = p.referencia
      GROUP BY p.referencia
    `);

    const productosFormateados = productos.map(producto => ({
      referencia: producto.referencia,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      talla: producto.talla,
      stock: producto.stock,
      precio_unidad: producto.precio_unidad,
      descuento: producto.descuento,
      precio_descuento: producto.precio_descuento,
      categoria: producto.categoria,
      subcategoria: producto.subcategoria,
      imagenes: producto.imagenes ? producto.imagenes.split(',') : []
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

async function ActualizarProducto(req, res) {
  const {
    referencia,
    nuevaReferencia,
    nombre,
    descripcion,
    talla,
    precio_unidad,
    descuento,
    FK_id_categoria,
    FK_id_subcategoria
  } = req.body;

  const archivos = req.files;

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

    // Actualizar el producto, sin campo "estado"
    await pool.execute(
      `UPDATE producto 
       SET referencia = ?, nombre = ?, descripcion = ?, talla = ?, 
           precio_unidad = ?, descuento = ?, precio_descuento = ?, 
           FK_id_categoria = ?, FK_id_subcategoria = ?
       WHERE referencia = ?`,
      [
        nuevaReferencia || referencia,
        nombre,
        descripcion,
        talla,
        precio_unidad,
        descuento,
        precioDesc,
        FK_id_categoria,
        FK_id_subcategoria,
        referencia
      ]
    );

    // Si la referencia cambió, actualizar también en producto_imagen
    if (nuevaReferencia && nuevaReferencia !== referencia) {
      await pool.execute(
        `UPDATE producto_imagen 
         SET FK_referencia_producto = ?
         WHERE FK_referencia_producto = ?`,
        [nuevaReferencia, referencia]
      );
    }

    // Guardar nuevas imágenes si vienen archivos
    if (archivos && archivos.length > 0) {
      for (const file of archivos) {
        const url = file.path;
        await pool.execute(
          `INSERT INTO producto_imagen (FK_referencia_producto, url_imagen) VALUES (?, ?)`,
          [nuevaReferencia || referencia, url]
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
