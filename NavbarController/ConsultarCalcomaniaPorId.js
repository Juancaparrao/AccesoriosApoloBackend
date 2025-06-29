const pool = require('../db');

async function ConsultarCalcomaniaPorId(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Calcomanía por ID ===");

        const { id } = req.params; // El ID de la calcomanía se espera en los parámetros de la URL

        // 1. Validar que el ID de calcomanía esté presente y sea un número válido
        if (!id || isNaN(id) || parseInt(id, 10) <= 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de calcomanía no proporcionado o no es válido.'
            });
        }

        const id_calcomania = parseInt(id, 10);

        // 2. Consulta SQL para obtener los detalles de la calcomanía
        const [rows] = await pool.execute(
            `SELECT
                id_calcomania,
                nombre,
                url_archivo,
                precio_unidad,
                precio_descuento,
                tamano_x,
                tamano_y
            FROM
                calcomania
            WHERE
                id_calcomania = ?`,
            [id_calcomania]
        );

        // 3. Verificar si se encontró la calcomanía
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: `Calcomanía con ID "${id_calcomania}" no encontrada.`
            });
        }

        const calcomania = rows[0];

        // 4. Formatear la respuesta de la calcomanía
        const calcomaniaFormateada = {
            id_calcomania: calcomania.id_calcomania,
            nombre: calcomania.nombre,
            url_archivo: calcomania.url_archivo,
            tamano_x: calcomania.tamano_x,
            tamano_y: calcomania.tamano_y
        };

        // Lógica condicional para el descuento y el ahorro
        const precioUnidad = parseFloat(calcomania.precio_unidad);
        const precioDescuento = parseFloat(calcomania.precio_descuento);

        if (calcomania.precio_descuento !== null && !isNaN(precioDescuento) && precioDescuento < precioUnidad) {
            // Si hay precio_descuento válido y es menor que precio_unidad
            calcomaniaFormateada.precio_descuento = parseFloat(precioDescuento.toFixed(2));
            calcomaniaFormateada.precio_unidad = parseFloat(precioUnidad.toFixed(2)); // Precio original sin descuento

            const ahorro = precioUnidad - precioDescuento;
            const descuentoPorcentaje = (ahorro / precioUnidad) * 100; // Cálculo del porcentaje de descuento

            calcomaniaFormateada.ahorro = parseFloat(ahorro.toFixed(2));
            calcomaniaFormateada.descuento = `${descuentoPorcentaje.toFixed(2)}%`; // Formatear a "X.XX%"
        } else {
            // Si no hay descuento o no es válido, solo se manda el precio_unidad
            calcomaniaFormateada.precio_unidad = parseFloat(precioUnidad.toFixed(2));
        }

        // 5. Devolver la respuesta
        return res.status(200).json({
            success: true,
            mensaje: 'Calcomanía consultada exitosamente.',
            calcomania: calcomaniaFormateada
        });

    } catch (error) {
        console.error('Error al consultar la calcomanía por ID:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar la calcomanía.'
        });
    }
}

module.exports = {
    ConsultarCalcomaniaPorId
};