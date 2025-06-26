const pool = require('../db'); // Asegúrate de que esta ruta sea correcta para tu conexión a la base de datos

/**
 * Consulta el detalle completo de una venta (factura, cliente, productos y calcomanías).
 * @param {object} req - Objeto de solicitud (request) de Express. Espera `id_factura` en `req.params`.
 * @param {object} res - Objeto de respuesta (response) de Express.
 */
async function ConsultarDetalleVenta(req, res) {
    // Extrae el ID de la factura de los parámetros de la solicitud
    const { id_factura } = req.params;

    try {
        // --- 1. Consultar los detalles principales de la FACTURA y del USUARIO (cliente) ---
        const [facturaRows] = await pool.execute(`
            SELECT
                f.id_factura,
                f.fecha_venta,
                f.metodo_pago,
                f.valor_total,
                u.cedula AS cedula_cliente,
                u.nombre AS nombre_cliente,
                u.correo AS correo_cliente,
                u.telefono AS telefono_cliente
            FROM factura f
            JOIN usuario u ON f.fk_id_usuario = u.id_usuario
            WHERE f.id_factura = ?
        `, [id_factura]);

        // Si no se encuentra la factura, retorna un error 404
        if (facturaRows.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: 'No se encontró la venta con ese ID'
            });
        }

        const factura = facturaRows[0]; // La información principal de la factura y el cliente

        // --- 2. Consultar los detalles de los PRODUCTOS de DETALLE_FACTURA ---
        const [productosDetalle] = await pool.execute(`
            SELECT
                df.FK_referencia_producto AS referencia,
                df.cantidad,
                df.precio_unidad AS precio_unidad_final_vendido, -- Precio real por unidad al momento de la venta
                p.nombre,
                p.precio_unidad AS producto_precio_base, -- Precio unitario original del producto (sin descuentos propios de la tabla PRODUCTO)
                p.precio_descuento AS producto_precio_descuento_flat -- Precio de descuento directo del producto
            FROM DETALLE_FACTURA df
            JOIN PRODUCTO p ON df.FK_referencia_producto = p.referencia
            WHERE df.FK_id_factura = ?
        `, [id_factura]);

        // --- 3. Consultar los detalles de las CALCOMANÍAS de DETALLE_FACTURA_CALCOMANIA ---
        const [calcomaniasDetalle] = await pool.execute(`
            SELECT
                dfc.FK_id_calcomania AS id_calcomania,
                dfc.cantidad,
                dfc.precio_unidad AS precio_unidad_final_vendido, -- Precio real por unidad al momento de la venta
                dfc.tamano,
                c.nombre,
                c.precio_unidad AS calcomania_precio_base_small, -- Precio unitario base para tamaño pequeño
                c.precio_descuento AS calcomania_precio_descuento_small -- Precio de descuento para tamaño pequeño
            FROM DETALLE_FACTURA_CALCOMANIA dfc
            JOIN CALCOMANIA c ON dfc.FK_id_calcomania = c.id_calcomania
            WHERE dfc.FK_id_factura = ?
        `, [id_factura]);

        // Array para almacenar todos los ítems (productos y calcomanías) de la factura
        let itemsFactura = [];

        // --- Procesar Productos ---
        productosDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad_final_vendido);
            const precioBaseProducto = parseFloat(item.producto_precio_base);
            const precioDescuentoProductoFlat = item.producto_precio_descuento_flat ? parseFloat(item.producto_precio_descuento_flat) : null;

            let precioOriginalDisplay = null; // Precio que se mostrará como "original" si hay descuento
            const epsilon = 0.01; // Margen para comparación de números flotantes

            // Determinar si hay un precio original (antes de descuento) para mostrar
            if (precioDescuentoProductoFlat !== null && precioDescuentoProductoFlat < precioBaseProducto - epsilon) {
                // Si hay un precio de descuento directo y es menor que el precio base,
                // y el precio vendido está cerca del precio de descuento,
                // entonces el precio original es el precio base.
                if (Math.abs(precioUnitarioVendido - precioDescuentoProductoFlat) < epsilon || precioUnitarioVendido < precioBaseProducto - epsilon) {
                    precioOriginalDisplay = precioBaseProducto;
                }
            } else if (precioUnitarioVendido < precioBaseProducto - epsilon) {
                // Si el precio vendido es menor que el precio base, incluso sin un precio_descuento explícito
                precioOriginalDisplay = precioBaseProducto;
            }

            itemsFactura.push({
                type: 'producto',
                referencia: item.referencia,
                nombre: item.nombre,
                cantidad: Number(item.cantidad),
                precio_unitario_final_vendido: precioUnitarioVendido,
                precio_original_display: precioOriginalDisplay, // Precio original si se aplicó un descuento
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        // --- Procesar Calcomanías ---
        calcomaniasDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad_final_vendido);
            const calcomaniaPrecioBaseSmall = parseFloat(item.calcomania_precio_base_small);
            const calcomaniaPrecioDescuentoSmall = item.calcomania_precio_descuento_small ? parseFloat(item.calcomania_precio_descuento_small) : null;
            const tamano = item.tamano;

            let originalPriceForThisSize = calcomaniaPrecioBaseSmall; // Precio base original para este tamaño (sin descuentos)

            // Ajusta el precio base original según los multiplicadores de tamaño
            switch (tamano) {
                case 'mediano':
                    originalPriceForThisSize = calcomaniaPrecioBaseSmall + (calcomaniaPrecioBaseSmall * 1.25);
                    break;
                case 'grande':
                    originalPriceForThisSize = calcomaniaPrecioBaseSmall + (calcomaniaPrecioBaseSmall * 3.00);
                    break;
            }
            originalPriceForThisSize = parseFloat(originalPriceForThisSize.toFixed(2)); // Redondea para comparaciones precisas

            let precioOriginalDisplay = null; // Precio que se mostrará como "original" si hay descuento
            const epsilon = 0.01; // Pequeño margen para comparación de números flotantes

            // Lógica para determinar si se muestra un precio "original" para calcomanías
            // Esto refleja cómo se calcula el descuento para calcomanías.
            if (calcomaniaPrecioDescuentoSmall !== null && calcomaniaPrecioDescuentoSmall > 0 && calcomaniaPrecioDescuentoSmall < calcomaniaPrecioBaseSmall) {
                // Hay un descuento base definido para la calcomanía pequeña
                const percentage_discount_from_base = ((calcomaniaPrecioBaseSmall - calcomaniaPrecioDescuentoSmall) / calcomaniaPrecioBaseSmall);
                const theoreticalDiscountedPriceForThisSize = parseFloat((originalPriceForThisSize * (1 - percentage_discount_from_base)).toFixed(2));

                // Si el precio vendido es el precio teórico con descuento o menor que el original
                if (Math.abs(precioUnitarioVendido - theoreticalDiscountedPriceForThisSize) < epsilon || precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                    precioOriginalDisplay = originalPriceForThisSize;
                }
            } else {
                // No hay descuento base definido para la calcomanía pequeña
                // Si el precio vendido es menor que el precio original para este tamaño (indica un descuento personalizado)
                if (precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                    precioOriginalDisplay = originalPriceForThisSize;
                }
            }

            itemsFactura.push({
                type: 'calcomania',
                id: item.id_calcomania, // Usamos 'id' para consistencia con 'referencia' de productos
                nombre: item.nombre,
                tamano: item.tamano,
                cantidad: Number(item.cantidad),
                precio_unitario_final_vendido: precioUnitarioVendido,
                precio_original_display: precioOriginalDisplay, // Precio original si se aplicó un descuento
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        // --- Ordenar los ítems para una presentación consistente ---
        // Primero por tipo (productos antes que calcomanías), luego alfabéticamente por nombre
        itemsFactura.sort((a, b) => {
            if (a.type === b.type) {
                return (a.nombre || '').localeCompare(b.nombre || '');
            }
            return a.type === 'producto' ? -1 : 1; // Productos primero
        });

        // --- Calcular Subtotal General (Precio antes de descuentos aplicados) ---
        // Suma el precio "original" de cada ítem, si existe, o el precio vendido si no hay descuento.
        const subtotalGeneralCalculado = itemsFactura.reduce((total, item) => {
            const priceToUse = item.precio_original_display !== null ? item.precio_original_display : item.precio_unitario_final_vendido;
            return total + (priceToUse * item.cantidad);
        }, 0);

        // --- Calcular Descuento Total ---
        // Suma la diferencia entre el precio original y el precio vendido para cada ítem.
        const descuentoTotalCalculado = itemsFactura.reduce((total, item) => {
            if (item.precio_original_display !== null && item.precio_original_display > item.precio_unitario_final_vendido) {
                return total + ((item.precio_original_display - item.precio_unitario_final_vendido) * item.cantidad);
            }
            return total;
        }, 0);


        // --- Funciones de Formato para la Respuesta ---
        const formatearNumero = (valor) => new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2, // Asegura 2 decimales para moneda
            maximumFractionDigits: 2
        }).format(valor);

        const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // --- Construir el Objeto de Respuesta Final ---
        const venta = {
            id: factura.id_factura,
            fecha_venta: formatearFecha(factura.fecha_venta),
            metodo_pago: factura.metodo_pago,
            valor_total: formatearNumero(factura.valor_total), // El valor total final de la DB
            subtotal_general: formatearNumero(subtotalGeneralCalculado), // Total antes de descuentos calculados
            descuento_total_aplicado: formatearNumero(descuentoTotalCalculado), // Descuento total calculado
            cliente: {
                cedula: factura.cedula_cliente,
                nombre: factura.nombre_cliente,
                correo: factura.correo_cliente,
                telefono: factura.telefono_cliente
            },
            items: itemsFactura.map(item => ({
                // Campos comunes
                type: item.type,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio_unitario_final_vendido: formatearNumero(item.precio_unitario_final_vendido),
                subtotal_item: formatearNumero(item.subtotal_item),
                // Campos específicos o adicionales
                referencia: item.type === 'producto' ? item.referencia : undefined, // Solo para productos
                id_calcomania: item.type === 'calcomania' ? item.id : undefined, // Solo para calcomanías
                tamano: item.type === 'calcomania' ? item.tamano : undefined, // Solo para calcomanías
                precio_original_display: item.precio_original_display ? formatearNumero(item.precio_original_display) : null // Si existió un precio original
            }))
        };

        // Enviar la respuesta exitosa
        return res.status(200).json({
            success: true,
            data: venta
        });

    } catch (error) {
        console.error('❌ Error al consultar detalle de venta:', error);
        // Retornar un mensaje de error interno del servidor
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al consultar el detalle de la venta'
        });
    }
}

// Exporta la función para que pueda ser utilizada en otras partes de la aplicación
module.exports = {
    ConsultarDetalleVenta
};
