// controllers/productosController.js

const pool = require('../db');

async function obtenerTopProductosConDescuento(req, res) {
    try {
        let productosEncontrados = [];
        let porcentajeActual = null;

        // Primero, obtener todos los porcentajes de descuento únicos y en orden descendente
        const [descuentosRows] = await pool.execute(
            `SELECT DISTINCT descuento
             FROM producto
             WHERE descuento IS NOT NULL AND descuento > 0
               AND estado = TRUE AND stock > 0
             ORDER BY descuento DESC`
        );

        const porcentajesDisponibles = descuentosRows.map(row => row.descuento);

        if (porcentajesDisponibles.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontraron productos con descuento disponibles.'
            });
        }

        // Iterar sobre los porcentajes de descuento de mayor a menor
        for (const porcentaje of porcentajesDisponibles) {
            const [rows] = await pool.execute(
                `SELECT
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
                 LEFT JOIN
                    producto_imagen pi ON p.referencia = pi.fk_referencia_producto
                 WHERE
                    p.descuento = ?
                    AND p.estado = TRUE
                    AND p.stock > 0
                    AND p.precio_descuento IS NOT NULL
                    AND p.precio_descuento < p.precio_unidad
                 GROUP BY
                    p.referencia,
                    p.nombre,
                    p.marca,
                    p.promedio_calificacion,
                    p.descuento,
                    p.precio_descuento,
                    p.precio_unidad
                 ORDER BY
                    p.precio_descuento ASC, p.precio_unidad ASC
                 LIMIT 3`, // Limitamos a 3 para optimizar, aunque podemos tomar más si luego necesitamos filtrar por cantidad exacta.
                [porcentaje]
            );

            // Formatear los productos encontrados en esta iteración
            // Formatear los productos encontrados en esta iteración
            const productosIteracion = rows.map(row => {
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

                // Aquí está el cambio:
                if (row.descuento !== null && row.descuento > 0 && precioDescuento < precioUnidad) {
                    producto.precio_descuento = precioDescuento;
                    // Anteriormente: producto.descuento = `${row.descuento}%`;
                    producto.descuento = String(row.descuento); // Convierte el número a string
                } else {
                    producto.precio_descuento = null;
                    producto.descuento = null;
                }
                return producto;
            });

            // Añadir los productos de esta iteración
            productosEncontrados = productosEncontrados.concat(productosIteracion);
            porcentajeActual = porcentaje; // Guardamos el porcentaje del cual se obtuvieron los productos

            // Si ya tenemos 3 o más productos, podemos parar.
            // Es importante tomar solo los primeros 3 después de concatenar para asegurar el "precio más bajo".
            if (productosEncontrados.length >= 3) {
                // Ordenar nuevamente por precio de descuento y tomar los primeros 3
                productosEncontrados.sort((a, b) => {
                    // Si ambos tienen precio_descuento, comparar por eso
                    if (a.precio_descuento !== null && b.precio_descuento !== null) {
                        return a.precio_descuento - b.precio_descuento;
                    }
                    // Si uno no tiene precio_descuento (es nulo), considerarlo "más caro"
                    if (a.precio_descuento === null) return 1;
                    if (b.precio_descuento === null) return -1;
                    // Si ambos son nulos o no relevantes para el descuento, comparar por precio_unidad
                    return a.precio_unidad - b.precio_unidad;
                });
                productosEncontrados = productosEncontrados.slice(0, 3);
                break; // Salir del bucle, ya tenemos suficientes productos
            }
        }

        // Si al final del bucle no se encontraron productos (lo cual es poco probable si porcentajesDisponibles no estaba vacío)
        if (productosEncontrados.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontraron productos con descuento que cumplan el criterio de 3 o más.'
            });
        }

        res.status(200).json({
            success: true,
            mensaje: `Se obtuvieron ${productosEncontrados.length} productos con un porcentaje de descuento de ${porcentajeActual}% (o superior, si se necesitó bajar).`,
            productos: productosEncontrados
        });

    } catch (error) {
        console.error('Error al obtener los top productos con descuento:', error);
        res.status(500).json({ mensaje: 'No se pudieron obtener los top productos con descuento.' });
    }
}

module.exports = {
    obtenerTopProductosConDescuento,
};