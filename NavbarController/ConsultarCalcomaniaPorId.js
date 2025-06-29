const pool = require('../db');

async function ConsultarCalcomaniaPorId(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Calcomanía por ID (Formato Descuento Actualizado) ===");

        const { id } = req.params;

        if (!id || isNaN(id) || parseInt(id, 10) <= 0) {
            return res.status(400).json({
                success: false,
                mensaje: 'ID de calcomanía no proporcionado o no es válido.'
            });
        }

        const id_calcomania = parseInt(id, 10);

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

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: `Calcomanía con ID "${id_calcomania}" no encontrada.`
            });
        }

        const calcomania = rows[0];

        const calcomaniaFormateada = {
            id_calcomania: calcomania.id_calcomania,
            nombre: calcomania.nombre,
            url_archivo: calcomania.url_archivo,
            tamano_x: calcomania.tamano_x,
            tamano_y: calcomania.tamano_y
        };

        const precioUnidad = parseFloat(calcomania.precio_unidad);
        const precioDescuento = parseFloat(calcomania.precio_descuento);

        if (calcomania.precio_descuento !== null && !isNaN(precioDescuento) && precioDescuento < precioUnidad) {
            calcomaniaFormateada.precio_descuento = parseFloat(precioDescuento.toFixed(2));
            calcomaniaFormateada.precio_unidad = parseFloat(precioUnidad.toFixed(2));

            const ahorro = precioUnidad - precioDescuento;
            const descuentoPorcentaje = (ahorro / precioUnidad) * 100;

            calcomaniaFormateada.ahorro = parseFloat(ahorro.toFixed(2));
            // Formatear el porcentaje:
            // Usamos Math.round para redondear a un entero si es muy cercano,
            // y luego verificamos si tiene decimales.
            const formattedDiscount = Math.round(descuentoPorcentaje * 100) / 100; // Redondea a 2 decimales para precisión antes de la verificación
            calcomaniaFormateada.descuento = `${formattedDiscount % 1 === 0 ? formattedDiscount : formattedDiscount.toFixed(2)}%`;
        } else {
            calcomaniaFormateada.precio_unidad = parseFloat(precioUnidad.toFixed(2));
        }

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