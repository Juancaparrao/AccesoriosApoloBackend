const pool = require('../db');

async function ConsultarProductosPorMarca(req, res) {
    try {
        console.log("=== DEBUG BACKEND - Consultar Productos por Marca (con excepción 'Otros') ===");

        const { marca } = req.params;

        // 1. Validar que la marca esté presente y sea un string válido
        if (!marca || typeof marca !== 'string' || marca.trim() === '') {
            return res.status(400).json({
                success: false,
                mensaje: 'Nombre de marca no proporcionado o no es válido.'
            });
        }

        let query;
        let queryParams = [];

        // Definir las marcas a excluir si se solicita "Otros"
        const marcasAExcluir = ['Ich', 'Shaft', 'Hro', 'Arai', 'Shoei'];

        // Lógica condicional para construir la consulta SQL
        if (marca.toLowerCase() === 'otros') {
            // Si la marca es "Otros", excluimos las marcas específicas
            query = `
                SELECT
                    p.referencia,
                    p.nombre,
                    (
                        SELECT url_imagen
                        FROM producto_imagen pi
                        WHERE pi.FK_referencia_producto = p.referencia
                        ORDER BY pi.id_imagen ASC
                        LIMIT 1
                    ) AS url_imagen_principal,
                    p.precio_unidad,
                    p.descuento,
                    p.precio_descuento,
                    p.marca,
                    p.promedio_calificacion
                FROM
                    producto p
                WHERE
                    p.marca NOT IN (?) AND p.estado = TRUE
            `;
            queryParams = [marcasAExcluir];
        } else {
            // Para cualquier otra marca, consultamos directamente por esa marca
            query = `
                SELECT
                    p.referencia,
                    p.nombre,
                    (
                        SELECT url_imagen
                        FROM producto_imagen pi
                        WHERE pi.FK_referencia_producto = p.referencia
                        ORDER BY pi.id_imagen ASC
                        LIMIT 1
                    ) AS url_imagen_principal,
                    p.precio_unidad,
                    p.descuento,
                    p.precio_descuento,
                    p.marca,
                    p.promedio_calificacion
                FROM
                    producto p
                WHERE
                    p.marca = ? AND p.estado = TRUE
            `;
            queryParams = [marca];
        }

        // 2. Ejecutar la consulta SQL construida dinámicamente
        const [productosQueryResult] = await pool.execute(query, queryParams);

        // 3. Procesar los resultados para incluir 'descuento' y 'precio_descuento' condicionalmente
        const productos = productosQueryResult.map(producto => {
            const formattedProducto = {
                referencia: producto.referencia,
                nombre: producto.nombre,
                url_imagen: producto.url_imagen_principal, // Usamos la URL de la imagen principal
                precio_unidad: parseFloat(producto.precio_unidad), // Aseguramos que sea un número
                marca: producto.marca,
                promedio_calificacion: parseFloat(producto.promedio_calificacion) || 0.0 // Aseguramos que sea un número, o 0.0 si es NULL
            };

            // Si tiene descuento, lo agregamos al objeto
            if (producto.descuento !== null && producto.descuento !== undefined) {
                formattedProducto.descuento = parseInt(producto.descuento, 10); // Aseguramos que sea un número
            }

            // Si tiene precio_descuento, lo agregamos al objeto
            if (producto.precio_descuento !== null && producto.precio_descuento !== undefined) {
                formattedProducto.precio_descuento = parseFloat(producto.precio_descuento); // Aseguramos que sea un número
            }

            return formattedProducto;
        });

        // 4. Verificar si se encontraron productos
        if (productos.length === 0) {
            let mensajeNoEncontrado = `No se encontraron productos activos para la marca "${marca}".`;
            if (marca.toLowerCase() === 'otros') {
                mensajeNoEncontrado = `No se encontraron productos activos de marcas diferentes a ${marcasAExcluir.join(', ')}.`;
            }
            return res.status(404).json({
                success: false,
                mensaje: mensajeNoEncontrado
            });
        }

        // 5. Devolver la respuesta con los productos encontrados
        let mensajeExito = `Productos activos de la marca "${marca}" consultados exitosamente.`;
        if (marca.toLowerCase() === 'otros') {
            mensajeExito = `Productos activos de otras marcas consultados exitosamente.`;
        }
        return res.status(200).json({
            success: true,
            mensaje: mensajeExito,
            productos: productos
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