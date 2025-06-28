const pool = require('../db');

async function ConsultarProductoPorReferencia(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Producto por Referencia con Ahorro ===");

        const { referencia } = req.params; // La referencia se espera en los parámetros de la URL

        // 1. Validar que la referencia esté presente y sea un string válido
        if (!referencia || typeof referencia !== 'string' || referencia.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'La referencia del producto no ha sido proporcionada o no es válida.'
            });
        }

        // 2. Consulta SQL para obtener los detalles del producto y el conteo de calificaciones
        const [rows] = await pool.execute(
            `SELECT
                p.referencia,
                p.nombre,
                p.descripcion,
                p.talla,
                p.url_archivo,
                p.precio_unidad,
                p.descuento,
                p.precio_descuento,
                p.marca,
                p.promedio_calificacion,
                COUNT(c.id_calificacion) AS numero_calificaciones -- Conteo de calificaciones
            FROM
                producto p
            LEFT JOIN
                calificacion c ON p.referencia = c.FK_referencia_producto
            WHERE
                p.referencia = ?
            GROUP BY
                p.referencia, p.nombre, p.descripcion, p.talla, p.url_archivo,
                p.precio_unidad, p.descuento, p.precio_descuento, p.marca, p.promedio_calificacion
            LIMIT 1`, // Aseguramos que solo traiga un resultado ya que 'referencia' es PRIMARY KEY
            [referencia]
        );

        // 3. Verificar si se encontró el producto
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: `Producto con referencia "${referencia}" no encontrado.`
            });
        }

        const producto = rows[0];

        // 4. Formatear la respuesta del producto
        const productoFormateado = {
            referencia: producto.referencia,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            talla: producto.talla,
            url_archivo: producto.url_archivo,
            marca: producto.marca,
            promedio_calificacion: parseFloat(producto.promedio_calificacion) || 0.0,
            numero_calificaciones: parseInt(producto.numero_calificaciones, 10) || 0 // Aseguramos que sea un número, o 0
        };

        // Lógica condicional para el descuento y el ahorro
        const precioUnidad = parseFloat(producto.precio_unidad);
        const precioDescuento = parseFloat(producto.precio_descuento);
        const descuentoPorcentaje = parseInt(producto.descuento, 10);

        if (producto.precio_descuento !== null && !isNaN(precioDescuento) && precioDescuento < precioUnidad) {
            // Si hay precio_descuento válido y es menor que precio_unidad
            productoFormateado.precio_descuento = parseFloat(precioDescuento.toFixed(2));
            productoFormateado.descuento = `${descuentoPorcentaje}%`; // Formatear a "X%"
            productoFormateado.precio_unidad = parseFloat(precioUnidad.toFixed(2)); // Precio original sin descuento
            productoFormateado.ahorro = parseFloat((precioUnidad - precioDescuento).toFixed(2));
        } else {
            // Si no hay descuento o no es válido, solo se manda el precio_unidad
            productoFormateado.precio_unidad = parseFloat(precioUnidad.toFixed(2));
        }

        // 5. Devolver la respuesta
        return res.status(200).json({
            success: true,
            mensaje: 'Producto consultado exitosamente.',
            producto: productoFormateado
        });

    } catch (error) {
        console.error('Error al consultar el producto por referencia:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar el producto.'
        });
    }
}

module.exports = {
    ConsultarProductoPorReferencia
};