const pool = require('../db');

async function ConsultarProductosPorMarca(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Productos por Marca ===");

        const { marca } = req.params;

        if (!marca || marca.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'Nombre de marca no proporcionado o no es válido.'
            });
        }

        let query;
        let queryParams = [];
        const marcasAExcluir = ['Ich', 'Shaft', 'Hro', 'Arai', 'Shoei'];

        // Lógica de consulta (se mantiene igual)
        if (marca.toLowerCase() === 'otros') {
            query = `
                SELECT p.referencia, p.nombre, p.precio_unidad, p.descuento, p.precio_descuento, p.marca, p.promedio_calificacion,
                       (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen
                FROM producto p
                WHERE p.marca NOT IN (?) AND p.estado = TRUE AND p.stock > 0`;
            queryParams = [marcasAExcluir];
        } else {
            query = `
                SELECT p.referencia, p.nombre, p.precio_unidad, p.descuento, p.precio_descuento, p.marca, p.promedio_calificacion,
                       (SELECT url_imagen FROM producto_imagen pi WHERE pi.FK_referencia_producto = p.referencia ORDER BY pi.id_imagen ASC LIMIT 1) AS url_imagen
                FROM producto p
                WHERE p.marca = ? AND p.estado = TRUE AND p.stock > 0`;
            queryParams = [marca];
        }

        const [productosDesdeDB] = await pool.execute(query, queryParams);

        if (productosDesdeDB.length === 0) {
            return res.status(200).json({
                success: true,
                mensaje: `No se encontraron productos activos para la selección de marca '${marca}'.`,
                data: []
            });
        }

        // --- Bloque de Transformación ---

        const productosFormateados = productosDesdeDB.map(producto => {
            const productoRespuesta = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                url_imagen: producto.url_imagen,
                precio_unidad: parseFloat(producto.precio_unidad),
                marca: producto.marca,
                promedio_calificacion: parseFloat(producto.promedio_calificacion) || 0.0
            };

            // Condición unificada: si hay un precio de descuento válido...
            if (producto.precio_descuento && parseFloat(producto.precio_descuento) > 0) {
                productoRespuesta.precio_descuento = parseFloat(producto.precio_descuento);
                // --- CAMBIO APLICADO: Formatear el descuento como string con "%" ---
                productoRespuesta.descuento = `${parseInt(producto.descuento, 10)}%`;
            }

            return productoRespuesta;
        });
        
        return res.status(200).json({
            success: true,
            mensaje: `Productos para la marca '${marca}' consultados exitosamente.`,
            data: productosFormateados
        });

    } catch (error) {
        console.error('Error al consultar productos por marca:', error);
        res.status(500).json({
            success: false,
            mensaje: 'Error interno del servidor al consultar productos por marca.'
        });
    }
}

module.exports = {
    ConsultarProductosPorMarca
};