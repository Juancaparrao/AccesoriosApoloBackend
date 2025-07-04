// controllers/productosController.js

const pool = require('../db'); // Asegúrate de que esta ruta sea correcta para tu conexión a la DB

async function obtenerProductosConDescuento(req, res) {
    const { tipo_articulo } = req.params; 

    // Normaliza el input para comparación (por si viene en minúsculas, etc.)
    const articuloNormalizado = tipo_articulo.toLowerCase();

    // Variable para construir la cláusula WHERE dinámica
    let condition = '';
    const queryParams = [];

    // Lógica para determinar el filtro según el tipo_articulo
    switch (articuloNormalizado) {
        case 'cascos':
            condition = 'c.nombre_categoria = ?';
            queryParams.push('Cascos'); 
            break;
        case 'equipacion-carretera': // Nuevo caso para la categoría "Equipación Carretera"
            condition = 'c.nombre_categoria = ?';
            queryParams.push('Equipación Carretera'); 
            break;
        case 'accesorios': // Nuevo caso para la categoría "Accesorios"
            condition = 'c.nombre_categoria = ?';
            queryParams.push('Accesorios'); 
            break;
        case 'luces': // Nuevo caso para la categoría "Luces"
            condition = 'c.nombre_categoria = ?';
            queryParams.push('Luces'); 
            break;
        default:
            return res.status(400).json({
                success: false,
                mensaje: "Tipo de artículo no válido. Use 'Cascos', 'Equipacion-Carretera', 'Accesorios' o 'Luces'."
            });
    }

    try {
        const query = `
            SELECT
                p.referencia,
                p.nombre,
                p.marca,
                MIN(pi.url_imagen) AS url_imagen,
                p.promedio_calificacion AS calificacion,
                p.descuento,
                p.precio_descuento,
                p.precio_unidad
            FROM
                producto p
            JOIN
                categoria c ON p.fk_id_categoria = c.id_categoria
            LEFT JOIN
                subcategoria s ON p.fk_id_subcategoria = s.id_subcategoria -- Mantener el JOIN por si se necesita para otros filtros, aunque para este caso solo se usa 'c'
            LEFT JOIN
                producto_imagen pi ON p.referencia = pi.fk_referencia_producto
            WHERE
                (${condition}) -- La condición dinámica ahora siempre filtra por categoría
                AND p.estado = TRUE
                AND p.stock > 0
                AND p.descuento IS NOT NULL 
                AND p.descuento > 0 
                AND p.precio_descuento IS NOT NULL 
                AND p.precio_descuento < p.precio_unidad 
            GROUP BY
                p.referencia, 
                p.nombre,
                p.marca,
                p.promedio_calificacion,
                p.descuento,
                p.precio_descuento,
                p.precio_unidad;
        `;

        const [rows] = await pool.execute(query, queryParams);

        const productosFormateados = rows.map(row => {
            const precioUnidad = parseFloat(row.precio_unidad);
            const precioDescuento = parseFloat(row.precio_descuento);

            const producto = {
                referencia: row.referencia,
                nombre: row.nombre,
                marca: row.marca,
                url_imagen: row.url_imagen,
                calificacion: parseFloat(row.calificacion),
                precio_unidad: precioUnidad,
            };

            if (row.descuento !== null && row.descuento > 0 && precioDescuento < precioUnidad) {
                producto.precio_descuento = precioDescuento;
                producto.descuento = `${row.descuento}%`; 
            }

            return producto;
        });

        if (productosFormateados.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: `No se encontraron productos con descuento disponibles para '${tipo_articulo}'.`
            });
        }

        res.status(200).json({
            success: true,
            productos: productosFormateados
        });

    } catch (error) {
        console.error(`Error al obtener productos con descuento para '${tipo_articulo}':`, error);
        res.status(500).json({ mensaje: 'No se pudieron obtener los productos con descuento.' });
    }
}

module.exports = {
    obtenerProductosConDescuento 
};