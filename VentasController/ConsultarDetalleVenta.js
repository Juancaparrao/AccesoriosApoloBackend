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
        // --- MODIFICACIÓN 1: Se añade 'metodo_pago_wompi' a la consulta ---
        const [facturaRows] = await pool.execute(`
            SELECT
                f.id_factura,
                f.fecha_venta,
                f.metodo_pago,
                f.metodo_pago_wompi,
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
                df.precio_unidad AS precio_unidad_final_vendido,
                p.nombre,
                p.precio_unidad AS producto_precio_base,
                p.precio_descuento AS producto_precio_descuento_flat
            FROM detalle_factura df
            JOIN producto p ON df.FK_referencia_producto = p.referencia
            WHERE df.FK_id_factura = ?
        `, [id_factura]);

        // --- 3. Consultar los detalles de las CALCOMANÍAS de DETALLE_FACTURA_CALCOMANIA ---
        const [calcomaniasDetalle] = await pool.execute(`
            SELECT
                dfc.FK_id_calcomania AS id_calcomania,
                dfc.cantidad,
                dfc.precio_unidad AS precio_unidad_final_vendido,
                dfc.tamano,
                c.nombre,
                c.precio_unidad AS calcomania_precio_base_small,
                c.precio_descuento AS calcomania_precio_descuento_small
            FROM detalle_factura_calcomania dfc
            JOIN calcomania c ON dfc.FK_id_calcomania = c.id_calcomania
            WHERE dfc.FK_id_factura = ?
        `, [id_factura]);

        let itemsFactura = [];

        // --- Procesar Productos ---
        productosDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad_final_vendido);
            const precioBaseProducto = parseFloat(item.producto_precio_base);
            const precioDescuentoProductoFlat = item.producto_precio_descuento_flat ? parseFloat(item.producto_precio_descuento_flat) : null;
            let precioOriginalDisplay = null;
            const epsilon = 0.01;
            if (precioDescuentoProductoFlat !== null && precioDescuentoProductoFlat < precioBaseProducto - epsilon) {
                if (Math.abs(precioUnitarioVendido - precioDescuentoProductoFlat) < epsilon || precioUnitarioVendido < precioBaseProducto - epsilon) {
                    precioOriginalDisplay = precioBaseProducto;
                }
            } else if (precioUnitarioVendido < precioBaseProducto - epsilon) {
                precioOriginalDisplay = precioBaseProducto;
            }
            itemsFactura.push({
                type: 'producto',
                referencia: item.referencia,
                nombre: item.nombre,
                cantidad: Number(item.cantidad),
                precio_unitario_final_vendido: precioUnitarioVendido,
                precio_original_display: precioOriginalDisplay,
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        // --- Procesar Calcomanías ---
        calcomaniasDetalle.forEach(item => {
            const precioUnitarioVendido = parseFloat(item.precio_unidad_final_vendido);
            const calcomaniaPrecioBaseSmall = parseFloat(item.calcomania_precio_base_small);
            const calcomaniaPrecioDescuentoSmall = item.calcomania_precio_descuento_small ? parseFloat(item.calcomania_precio_descuento_small) : null;
            let originalPriceForThisSize = calcomaniaPrecioBaseSmall;
            switch (item.tamano) {
                case 'mediano': originalPriceForThisSize *= 2.25; break; // Multiplicador corregido
                case 'grande': originalPriceForThisSize *= 4.00; break; // Multiplicador corregido
            }
            originalPriceForThisSize = parseFloat(originalPriceForThisSize.toFixed(2));
            let precioOriginalDisplay = null;
            const epsilon = 0.01;
            if (calcomaniaPrecioDescuentoSmall !== null && calcomaniaPrecioDescuentoSmall > 0 && calcomaniaPrecioDescuentoSmall < calcomaniaPrecioBaseSmall) {
                const percentage_discount_from_base = ((calcomaniaPrecioBaseSmall - calcomaniaPrecioDescuentoSmall) / calcomaniaPrecioBaseSmall);
                const theoreticalDiscountedPriceForThisSize = parseFloat((originalPriceForThisSize * (1 - percentage_discount_from_base)).toFixed(2));
                if (Math.abs(precioUnitarioVendido - theoreticalDiscountedPriceForThisSize) < epsilon || precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                    precioOriginalDisplay = originalPriceForThisSize;
                }
            } else if (precioUnitarioVendido < originalPriceForThisSize - epsilon) {
                precioOriginalDisplay = originalPriceForThisSize;
            }
            itemsFactura.push({
                type: 'calcomania',
                id: item.id_calcomania,
                nombre: item.nombre,
                tamano: item.tamano,
                cantidad: Number(item.cantidad),
                precio_unitario_final_vendido: precioUnitarioVendido,
                precio_original_display: precioOriginalDisplay,
                subtotal_item: parseFloat((precioUnitarioVendido * item.cantidad).toFixed(2))
            });
        });

        itemsFactura.sort((a, b) => {
            if (a.type === b.type) return (a.nombre || '').localeCompare(b.nombre || '');
            return a.type === 'producto' ? -1 : 1;
        });

        const subtotalGeneralCalculado = itemsFactura.reduce((total, item) => (total + ((item.precio_original_display || item.precio_unitario_final_vendido) * item.cantidad)), 0);
        const descuentoTotalCalculado = itemsFactura.reduce((total, item) => {
            if (item.precio_original_display && item.precio_original_display > item.precio_unitario_final_vendido) {
                return total + ((item.precio_original_display - item.precio_unitario_final_vendido) * item.cantidad);
            }
            return total;
        }, 0);

        const formatearNumero = (valor) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
        const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

        // --- Construir el Objeto de Respuesta Final ---
        const venta = {
            id: factura.id_factura,
            fecha_venta: formatearFecha(factura.fecha_venta),
            // --- MODIFICACIÓN 2: Lógica para seleccionar el método de pago a mostrar ---
            metodo_pago: factura.metodo_pago || factura.metodo_pago_wompi || 'No especificado',
            valor_total: formatearNumero(factura.valor_total),
            subtotal_general: formatearNumero(subtotalGeneralCalculado),
            descuento_total_aplicado: formatearNumero(descuentoTotalCalculado),
            cliente: {
                cedula: factura.cedula_cliente,
                nombre: factura.nombre_cliente,
                correo: factura.correo_cliente,
                telefono: factura.telefono_cliente
            },
            items: itemsFactura.map(item => ({
                type: item.type,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio_unitario_final_vendido: formatearNumero(item.precio_unitario_final_vendido),
                subtotal_item: formatearNumero(item.subtotal_item),
                referencia: item.type === 'producto' ? item.referencia : undefined,
                id_calcomania: item.type === 'calcomania' ? item.id : undefined,
                tamano: item.type === 'calcomania' ? item.tamano : undefined,
                precio_original_display: item.precio_original_display ? formatearNumero(item.precio_original_display) : null
            }))
        };

        return res.status(200).json({
            success: true,
            data: venta
        });

    } catch (error) {
        console.error('❌ Error al consultar detalle de venta:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error interno al consultar el detalle de la venta'
        });
    }
}

module.exports = {
    ConsultarDetalleVenta
};