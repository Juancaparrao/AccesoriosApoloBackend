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

async function ActualizarProducto(req, res) {
  const {
    referencia,
    nombre,
    descripcion,
    talla,
    url_archivo,
    precio_unidad,
    descuento,
    FK_id_categoria,
    FK_id_subcategoria,
    estado
  } = req.body;

  try {
    // Verificar que el producto existe
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

    // Calcular el precio con descuento
    const precioDesc = precio_unidad - (precio_unidad * (descuento / 100));

    // Actualizar los datos del producto (sin incluir el stock)
    await pool.execute(
      `UPDATE producto 
       SET nombre = ?, descripcion = ?, talla = ?, url_archivo = ?, 
           precio_unidad = ?, descuento = ?, precio_descuento = ?, 
           FK_id_categoria = ?, FK_id_subcategoria = ?, estado = ?
       WHERE referencia = ?`,
      [
        nombre,
        descripcion,
        talla,
        url_archivo,
        precio_unidad,
        descuento,
        precioDesc,
        FK_id_categoria,
        FK_id_subcategoria,
        estado,
        referencia
      ]
    );

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
