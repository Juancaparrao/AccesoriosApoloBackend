// controllers/invoiceManager.js
const pool = require('../db');

// --- CONSTANTES DE CONFIGURACIÓN ---
// Define el tiempo de vida de una factura pendiente en minutos.
const TIEMPO_EXPIRACION_MINUTOS = 5; 
// Define cada cuánto se ejecutará la tarea de limpieza (en milisegundos).
// 1 minuto (60000 ms) es un buen valor. Es frecuente pero no sobrecarga el sistema.
const INTERVALO_VERIFICACION_MS = 60000; 


async function completarFacturaPagada(facturaId, userId) {
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log(`--- Completando factura pagada ${facturaId} para usuario ${userId} ---`);

        // 1. Verificar que la factura existe y está pagada
        const [facturaRows] = await connection.execute(
            `SELECT id_factura, estado_pedido, fk_id_usuario FROM factura 
             WHERE id_factura = ? AND estado_pedido = 'Pagada'`,
            [facturaId]
        );

        if (facturaRows.length === 0) {
            throw new Error(`Factura ${facturaId} no encontrada o no está en estado 'Pagada'`);
        }

        const factura = facturaRows[0];
        
        // Verificar que el usuario sea el dueño de la factura
        if (factura.fk_id_usuario !== userId) {
            throw new Error(`Usuario ${userId} no es el propietario de la factura ${facturaId}`);
        }

        // 2. Obtener items del carrito del usuario
        const [carritoItems] = await connection.execute(`
            SELECT 
                c.FK_referencia_producto,
                c.FK_id_calcomania,
                c.cantidad,
                c.tamano,
                p.precio_unidad as precio_producto,
                p.stock as stock_producto,
                cal.precio_unidad as precio_calcomania,
                cal.stock_pequeno,
                cal.stock_mediano,
                cal.stock_grande
            FROM CARRITO_COMPRAS c
            LEFT JOIN PRODUCTO p ON c.FK_referencia_producto = p.referencia
            LEFT JOIN CALCOMANIA cal ON c.FK_id_calcomania = cal.id_calcomania
            WHERE c.FK_id_usuario = ?
        `, [userId]);

        if (carritoItems.length === 0) {
            console.log(`No hay items en el carrito para el usuario ${userId}`);
            await connection.commit();
            return { success: true, message: 'No hay items para procesar' };
        }

        console.log(`Procesando ${carritoItems.length} items del carrito`);

        // 3. Procesar cada item del carrito
        for (const item of carritoItems) {
            if (item.FK_referencia_producto) {
                // PROCESAR PRODUCTO
                const precioUnitario = item.precio_producto;
                const stockActual = item.stock_producto;
                
                // Verificar stock suficiente
                if (stockActual < item.cantidad) {
                    throw new Error(`Stock insuficiente para producto ${item.FK_referencia_producto}. Stock: ${stockActual}, Solicitado: ${item.cantidad}`);
                }

                // Insertar en detalle_factura
                await connection.execute(`
                    INSERT INTO DETALLE_FACTURA (FK_id_factura, FK_referencia_producto, cantidad, precio_unidad)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        cantidad = cantidad + VALUES(cantidad)
                `, [facturaId, item.FK_referencia_producto, item.cantidad, precioUnitario]);

                // Reducir stock del producto
                await connection.execute(`
                    UPDATE PRODUCTO 
                    SET stock = stock - ? 
                    WHERE referencia = ? AND stock >= ?
                `, [item.cantidad, item.FK_referencia_producto, item.cantidad]);

                console.log(`✅ Producto ${item.FK_referencia_producto}: ${item.cantidad} unidades agregadas, stock reducido`);

            } else if (item.FK_id_calcomania) {
                // PROCESAR CALCOMANIA
                const precioUnitario = item.precio_calcomania;
                const tamano = item.tamano || 'mediano'; // Default mediano si no se especifica

                let stockDisponible = 0;
                let campoStock = '';

                // Determinar qué stock usar según el tamaño
                switch (tamano.toLowerCase()) {
                    case 'pequeno':
                    case 'pequeño':
                        stockDisponible = item.stock_pequeno;
                        campoStock = 'stock_pequeno';
                        break;
                    case 'mediano':
                        stockDisponible = item.stock_mediano;
                        campoStock = 'stock_mediano';
                        break;
                    case 'grande':
                        stockDisponible = item.stock_grande;
                        campoStock = 'stock_grande';
                        break;
                    default:
                        throw new Error(`Tamaño de calcomanía no válido: ${tamano}`);
                }

                // Verificar stock suficiente
                if (stockDisponible < item.cantidad) {
                    throw new Error(`Stock insuficiente para calcomanía ${item.FK_id_calcomania} tamaño ${tamano}. Stock: ${stockDisponible}, Solicitado: ${item.cantidad}`);
                }

                // Insertar en detalle_factura_calcomania
                await connection.execute(`
                    INSERT INTO DETALLE_FACTURA_CALCOMANIA (FK_id_factura, FK_id_calcomania, cantidad, precio_unidad, tamano)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        cantidad = cantidad + VALUES(cantidad)
                `, [facturaId, item.FK_id_calcomania, item.cantidad, precioUnitario, tamano]);

                // Reducir stock de la calcomanía según el tamaño
                await connection.execute(`
                    UPDATE CALCOMANIA 
                    SET ${campoStock} = ${campoStock} - ? 
                    WHERE id_calcomania = ? AND ${campoStock} >= ?
                `, [item.cantidad, item.FK_id_calcomania, item.cantidad]);

                console.log(`✅ Calcomanía ${item.FK_id_calcomania} (${tamano}): ${item.cantidad} unidades agregadas, stock reducido`);
            }
        }

        // 4. Eliminar todos los items del carrito del usuario
        const [deleteResult] = await connection.execute(`
            DELETE FROM CARRITO_COMPRAS WHERE FK_id_usuario = ?
        `, [userId]);

        console.log(`🗑️ ${deleteResult.affectedRows} items eliminados del carrito`);

        // 5. Actualizar fecha de procesamiento de la factura
        await connection.execute(`
            UPDATE factura 
            SET fecha_actualizacion = NOW() 
            WHERE id_factura = ?
        `, [facturaId]);

        await connection.commit();
        
        console.log(`✅ Factura ${facturaId} completada exitosamente`);
        
        return {
            success: true,
            message: 'Factura completada exitosamente',
            itemsProcesados: carritoItems.length,
            itemsEliminados: deleteResult.affectedRows
        };

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error(`❌ Error al completar factura ${facturaId}:`, error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


/**
 * VERSIÓN CORREGIDA:
 * Elimina las facturas que han superado su tiempo de vida y siguen pendientes.
 * Esta función se ejecuta periódicamente para limpiar el sistema.
 */
async function eliminarFacturasExpiradas() {
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log(`[TAREA AUTOMÁTICA] Buscando facturas pendientes expiradas (más de ${TIEMPO_EXPIRACION_MINUTOS} min)...`);

        // 1. Buscar facturas que cumplen AMBAS condiciones:
        //    a) Su estado NO es 'Pagada' o 'Completada'.
        //    b) Su fecha de creación fue hace MÁS de `TIEMPO_EXPIRACION_MINUTOS`.
        //       `DATE_SUB(NOW(), INTERVAL ? MINUTE)` calcula la hora de corte.
        //       Cualquier factura creada ANTES de esa hora, ha expirado.
        const [facturasParaEliminar] = await connection.execute(`
            SELECT id_factura, estado_pedido, fecha_venta, fk_id_usuario
            FROM factura 
            WHERE estado_pedido NOT IN ('Pagada', 'Completada') 
              AND fecha_venta < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        `, [TIEMPO_EXPIRACION_MINUTOS]);

        if (facturasParaEliminar.length === 0) {
            console.log('[TAREA AUTOMÁTICA] No se encontraron facturas expiradas para eliminar.');
            await connection.commit(); // Es importante hacer commit incluso si no hay nada que hacer.
            return { facturasEliminadas: 0 };
        }

        console.log(`[TAREA AUTOMÁTICA] Se encontraron ${facturasParaEliminar.length} facturas expiradas. Procediendo a eliminar.`);

        // 2. Extraer los IDs de las facturas para usarlos en las consultas de borrado.
        const idsFacturas = facturasParaEliminar.map(f => f.id_factura);

        // 3. Eliminar los detalles asociados a esas facturas (en una sola consulta para eficiencia).
        //    (IMPORTANTE: Asegúrate de tener FK con ON DELETE CASCADE para simplificar esto, 
        //     si no, este borrado manual es la forma correcta).
        await connection.execute(`DELETE FROM DETALLE_FACTURA WHERE FK_id_factura IN (?)`, [idsFacturas]);
        await connection.execute(`DELETE FROM DETALLE_FACTURA_CALCOMANIA WHERE FK_id_factura IN (?)`, [idsFacturas]);

        // 4. Eliminar las facturas principales.
        const [deleteResult] = await connection.execute(`
            DELETE FROM factura WHERE id_factura IN (?)
        `, [idsFacturas]);
        
        const facturasEliminadas = deleteResult.affectedRows;

        await connection.commit();
        
        console.log(`[TAREA AUTOMÁTICA] ✅ Limpieza completada. Se eliminaron ${facturasEliminadas} facturas.`);
        
        // Opcional: Registrar qué facturas se eliminaron
        facturasParaEliminar.forEach(factura => {
            console.log(`  -> 🗑️ Factura ${factura.id_factura} (Estado: ${factura.estado_pedido}) creada el ${factura.fecha_venta} ha sido eliminada.`);
        });

        return { facturasEliminadas };

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ [TAREA AUTOMÁTICA] Error durante la limpieza de facturas expiradas:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * VERSIÓN CORREGIDA:
 * Inicia el proceso automático que verifica periódicamente las facturas expiradas.
 * Esta función debe ser llamada UNA SOLA VEZ cuando tu aplicación se inicia.
 * (Por ejemplo, en tu archivo principal `app.js` o `server.js`).
 */
function iniciarVerificacionDeFacturas() {
    console.log(`🕒 Servicio de verificación de facturas iniciado. Se ejecutará cada ${INTERVALO_VERIFICACION_MS / 1000} segundos.`);
    
    // Ejecuta la función una vez al iniciar, por si había facturas pendientes de un reinicio.
    eliminarFacturasExpiradas().catch(error => {
        console.error('Error en la ejecución inicial de limpieza:', error);
    });
    
    // Configura la ejecución periódica.
    const intervalId = setInterval(() => {
        eliminarFacturasExpiradas().catch(error => {
            // Usamos .catch() para que un error en una ejecución no detenga el intervalo.
            console.error('Error en la ejecución periódica de limpieza:', error);
        });
    }, INTERVALO_VERIFICACION_MS);

    return intervalId; // Devuelve el ID por si necesitas detenerlo en el futuro (ej. para tests).
}

/**
 * Endpoint manual para forzar la limpieza de facturas. Útil para depuración.
 * (Esta función estaba bien, solo la adapto al nuevo nombre de la función de limpieza).
 */
async function forzarLimpiezaFacturas(req, res) {
    try {
        const resultado = await eliminarFacturasExpiradas();
        res.status(200).json({
            success: true,
            message: 'Limpieza manual de facturas completada.',
            ...resultado
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error durante la limpieza manual de facturas.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

module.exports = {
    completarFacturaPagada,       
    eliminarFacturasExpiradas,    
    iniciarVerificacionDeFacturas, 
    forzarLimpiezaFacturas        
};