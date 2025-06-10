// Registrar Producto
async function RegistrarProducto(req, res) {
  try {
    const {
      referencia,
      nombre,
      descripcion,
      talla,
      marca,
      url_archivo,
      precio_unidad,
      descuento,
      FK_id_categoria,
      FK_id_subcategoria
    } = req.body;

    if (
      !referencia || !nombre || !descripcion || !talla || !marca || !precio_unidad || descuento === undefined ||
      !FK_id_categoria || !FK_id_subcategoria
    ) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan campos obligatorios.'
      });
    }

    // Validar que se suba al menos una imagen
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe subir al menos una imagen del producto.'
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

    const precio = parseFloat(precio_unidad);
    const desc = parseFloat(descuento);
    const precioDescuentoCalculado = parseFloat((precio - (precio * (desc / 100))).toFixed(2));

    // Insertar producto
    await pool.execute(
      `INSERT INTO producto 
       (referencia, nombre, descripcion, talla, marca, stock, url_archivo, precio_unidad, descuento, precio_descuento, FK_id_categoria, FK_id_subcategoria, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        referencia,
        nombre,
        descripcion || null,
        talla || null,
        marca,
        0,
        null, // o usar url_archivo || null si lo necesitas
        precio,
        desc,
        precioDescuentoCalculado,
        FK_id_categoria,
        FK_id_subcategoria,
        1
      ]
    );

    // Subir imágenes a Cloudinary
    for (const file of req.files) {
      const subida = await cloudinary.uploader.upload(file.path, {
        folder: 'productos'
      });
      await pool.execute(
        'INSERT INTO producto_imagen (FK_referencia_producto, url_imagen) VALUES (?, ?)',
        [referencia, subida.secure_url]
      );
    }

    return res.status(201).json({
      success: true,
      mensaje: 'Producto registrado exitosamente.',
      producto: {
        referencia,
        nombre,
        marca,
        precio_unidad: precio,
        descuento: desc,
        precio_descuento: precioDescuentoCalculado
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
