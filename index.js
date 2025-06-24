const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = 3000;
const  upload  = require('./multer');
const {solicitarRecuperacion, cambiarContrasena } = require('./InicioController/RecuperarContrasena');
const { solicitarOTP, reenviarOTP, verificarOTPHandler } = require('./InicioController/OTP');
const { login } = require('./InicioController/Login');
const { obtenerNombre } = require('./InicioController/GeneralInicio');
const { verificarToken } = require('./InicioController/middleware');
const { loginConGoogle } = require('./InicioController/GoogleAuth');
const { loginConFacebook } = require('./InicioController/FacebookAuth');
const { obtenerPerfil } = require('./InicioController/Perfil');
const { validarGerente } = require('./UsuariosController/validacionesUsuarios');
const { registrarUsuarioDirecto } = require('./UsuariosController/registrarUsuarios');
const { consultarUsuarios } = require('./UsuariosController/consultarUsuarios');
const { buscarUsuarioPorCorreo } = require('./UsuariosController/BuscarUsuarioPorCorreo');
const { obtenerDatosUsuario, actualizarUsuario } = require('./UsuariosController/ActualizarUsuario');
const { eliminarUsuario } = require('./UsuariosController/EliminarUsuario');
const { reactivarUsuario } = require('./UsuariosController/ReactivarUsuario');
const { EditarPerfil } = require('./InicioController/EditarPerfil');
const { RegistrarProveedor } = require('./ProveedoresController/RegistrarProveedor');
const { ConsultarProveedor } = require('./ProveedoresController/ConsultarProveedor');
const { ReactivarProveedor } = require('./ProveedoresController/ReactivarProveedor');
const { EliminarProveedor } = require('./ProveedoresController/EliminarProveedor');
const { ObtenerDatosProveedor, ActualizarProveedor } = require('./ProveedoresController/ActualizarProveedor');
const { BuscarProveedorPorNit } = require('./ProveedoresController/BuscarProveedorPorNit');
const { RegistrarCategoria } = require('./CategoriasController/RegistrarCategoria');
const { ConsultarCategoria } = require('./CategoriasController/ConsultarCategoria');
const { EliminarCategoria } = require('./CategoriasController/EliminarCategoria');
const { ObtenerDatosCategoria, ActualizarCategoria } = require('./CategoriasController/ActualizarCategoria');
const { ReactivarCategoria } = require('./CategoriasController/ReactivarCategoria');
const { BuscarCategoriaPorNombre } = require('./CategoriasController/BuscarCategoriaPorNombre');
const { RegistrarSubcategoria } = require('./SubcategoriasController/RegistrarSubcategoria');
const { ConsultarSubcategoria } = require('./SubcategoriasController/ConsultarSubcategoria');
const { EliminarSubcategoria } = require('./SubcategoriasController/EliminarSubcategoria');
const { ReactivarSubcategoria } = require('./SubcategoriasController/ReactivarSubcategoria');
const { ActualizarSubcategoria, ObtenerDatosSubcategoria } = require('./SubcategoriasController/ActualizarSubcategoria');
const { BuscarSubcategoriaPorNombre } = require('./SubcategoriasController/BuscarSubcategoriaPorNombre');
const { RegistrarProducto, ObtenerCategorias, ObtenerSubcategoriasPorCategoria } = require('./ProductosController/RegistrarProducto');
const { ConsultarProducto } = require('./ProductosController/ConsultarProducto');
const { ActualizarProducto, ObtenerProductos } = require('./ProductosController/ActualizarProducto');
const { EliminarProducto } = require('./ProductosController/EliminarProducto');
const { ReactivarProducto } = require('./ProductosController/ReactivarProducto');
const { BuscarProductoPorReferencia } = require('./ProductosController/BuscarProductoPorReferencia');
const { ConsultarFacturasProveedor } = require('./FacturasProveedorController/ConsultarFacturasProveedor');
const { RegistrarFacturasProveedor, BuscarProductoFacturaPorReferencia } = require('.//FacturasProveedorController/RegistrarFacturasProveedor');
const { ConsultarDetalleFacturaProveedor } = require('./FacturasProveedorController/ConsultarDetalleFacturaProveedor');
const { RegistrarCalcomania } = require('./CalcomaniasController/RegistrarCalcomania');
const { ConsultarCalcomania } = require('./CalcomaniasController/ConsultarCalcomania');
const { ActualizarCalcomania, ObtenerDatosCalcomania } = require('./CalcomaniasController/ActualizarCalcomania'); 
const { EliminarCalcomania } = require('./CalcomaniasController/EliminarCalcomania');
const { ReactivarCalcomania } = require('./CalcomaniasController/ReactivarCalcomania');
const { BuscarCalcomaniaPorNombre } = require('./CalcomaniasController/BuscarCalcomaniaPorNombre');
const { RegistrarVenta, ValidarClientePorCedula, BuscarProductoVentaPorReferencia } = require('./VentasController/RegistrarVenta');
const { ConsultarVenta } = require('./VentasController/ConsultarVenta');
const { ConsultarDetalleVenta } = require('./VentasController/ConsultarDetalleVenta');
const { ConsultarInventario } = require('./InventariosController/ConsultarInventario');
const { GenerarInventario } = require('./InventariosController/GenerarInventario');
const { GenerarPDFInventario } = require('./InventariosController/GenerarPDFInventario');
const { GenerarPDFInventarioDescargar } = require('./InventariosController/GenerarPDFInventarioDescargar');
const { ConsultarInventarioPorFecha } = require('./InventariosController/ConsultarInventarioPorFecha');
const { ConsultarVentaEspecifica } = require('./VentasController/ConsultarVentaPorFecha&Cedula');
const { obtenerCategoriasConValor } = require('./InventariosController/EstadisticasInventario.js/obtenerCategoriasConValor');
const { obtenerTopProductosMasStock, obtenerTopProductosMenosStock } = require('./InventariosController/EstadisticasInventario.js/obtenerTopProductosStock');
const { obtenerInventariosUltimos7Dias } = require('./InventariosController/EstadisticasInventario.js/obtenerInventariosUltimos7Dias');
const { handleContactForm } = require('./templates/FormularioContactoCorreo');
const { ConsultarCalcomaniasPorUsuario } = require('./CalcomaniasController/ConsultarCalcomaniasPorUsuario');
const { EditarNombreCalcomania } = require('./CalcomaniasController/EditarNombreCalcomania');
const { EliminarCalcomaniaUsuario } = require('./CalcomaniasController/EliminarCalcomaniasUsuario');

// ====== IMPORTAR FUNCIONES DE INVENTARIO AUTOMÁTICO ======
const { 
  GenerarInventarioAutomatico, 
  verificarEstadoCron, 
  probarConexionDB, 
  probarCronJob 
} = require('./InventariosController/GenerarInventario');

app.use(cors({
  origin: ['http://localhost:5173', 'https://accesorios-apolo-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Rutas de registro con OTP
app.post('/solicitar-otp', solicitarOTP);
app.post('/reenviar-otp', reenviarOTP);
app.post('/verificar-otp', verificarOTPHandler);

// Ruta de login
app.post('/login', login);

// Ruta para obtener nombre del usuario
app.post('/obtener-nombre', obtenerNombre);

// Ruta protegida con JWT
app.get('/perfil', verificarToken, obtenerPerfil);
app.put('/editar-perfil', verificarToken, EditarPerfil);

// Recuperar contraseña
app.post('/recuperar', solicitarRecuperacion);
app.post('/cambiar-contrasena', cambiarContrasena);

// Ruta de login con Google
app.post('/login-google', loginConGoogle);

// Ruta de login con Facebook
app.post('/auth/facebook', loginConFacebook);

//Validar gerente
app.get('/validar-gerente', verificarToken, validarGerente);

//Modulo de usuarios
app.post('/registrar-directo', registrarUsuarioDirecto);
app.get('/usuarios', verificarToken, consultarUsuarios);
app.get('/buscar-usuario-correo', buscarUsuarioPorCorreo);
app.post('/obtener-usuario-por-correo', obtenerDatosUsuario);
app.put('/actualizar-usuario', actualizarUsuario);
app.put('/eliminar-usuario', eliminarUsuario);
app.put('/reactivar-usuario', reactivarUsuario);

// Módulo de proveedores
app.post('/registrar-proveedor', RegistrarProveedor);
app.get('/proveedores', ConsultarProveedor);
app.put('/eliminar-proveedor', EliminarProveedor);
app.put('/reactivar-proveedor', ReactivarProveedor);
app.post('/obtener-proveedor', ObtenerDatosProveedor);
app.put('/actualizar-proveedor', ActualizarProveedor);
app.get('/buscar-proveedor', BuscarProveedorPorNit);

// Módulo de categorías
app.post('/registrar-categoria', RegistrarCategoria);
app.get('/categorias', ConsultarCategoria);
app.put('/eliminar-categoria', EliminarCategoria);
app.post('/obtener-categoria', ObtenerDatosCategoria);
app.put('/actualizar-categoria', ActualizarCategoria);
app.put('/reactivar-categoria', ReactivarCategoria);
app.get('/buscar-categoria-nombre', BuscarCategoriaPorNombre);

// Módulo de subcategorías
app.post('/registrar-subcategoria', upload.single('imagen'), RegistrarSubcategoria);
app.get('/subcategorias', ConsultarSubcategoria);
app.put('/eliminar-subcategoria', EliminarSubcategoria);
app.put('/reactivar-subcategoria', ReactivarSubcategoria);
app.post('/obtener-subcategoria', ObtenerDatosSubcategoria);
app.put('/actualizar-subcategoria', upload.single('imagen'), ActualizarSubcategoria);
app.get('/buscar-subcategoria-nombre', BuscarSubcategoriaPorNombre);

// Módulo de productos
app.post('/registrar-producto', upload.array('imagenes', 8), RegistrarProducto);
app.get('/categorias-productos', ObtenerCategorias);
app.get('/subcategorias-productos/:id_categoria', ObtenerSubcategoriasPorCategoria);
app.get('/consultar-producto', ConsultarProducto);
app.get('/obtener-productos', ObtenerProductos);
app.put('/actualizar-producto', upload.array('imagenes', 8), ActualizarProducto);
app.put('/eliminar-producto', EliminarProducto);
app.put('/reactivar-producto', ReactivarProducto);
app.get('/buscar-producto-referencia', BuscarProductoPorReferencia);

// Modulo de Facturas Proveedor
app.post('/registrar-factura-proveedor', RegistrarFacturasProveedor);
app.get('/buscar-producto-factura-referencia', BuscarProductoFacturaPorReferencia);
app.get('/facturas-proveedores', ConsultarFacturasProveedor);
app.get('/consultar-detalle-factura-proveedor/:id_factura_proveedor', ConsultarDetalleFacturaProveedor);

// Módulo de Calcomanías
app.post('/registrar-calcomania', verificarToken, upload.single('imagen'), RegistrarCalcomania);
app.get('/calcomanias', ConsultarCalcomania);
app.post('/obtener-calcomania', ObtenerDatosCalcomania);
app.put('/actualizar-calcomania', upload.single('imagen'), ActualizarCalcomania);
app.put('/eliminar-calcomania', EliminarCalcomania);
app.put('/reactivar-calcomania', ReactivarCalcomania);
app.get('/buscar-calcomania-nombre', BuscarCalcomaniaPorNombre);
app.get('/calcomanias-usuario',verificarToken, ConsultarCalcomaniasPorUsuario);
app.delete('/eliminar-calcomanias/:id_calcomania', EliminarCalcomaniaUsuario);
app.put('/editar-nombre-calcomanias/:id_calcomania', EditarNombreCalcomania);

//Módulo de Ventas
app.post('/registrar-venta',  RegistrarVenta);
app.get('/validar-cliente-venta', ValidarClientePorCedula);
app.get('/buscar-producto-venta-referencia', BuscarProductoVentaPorReferencia);
app.get('/Consultar-ventas', ConsultarVenta);
app.get('/Consultar-detalle-venta/:id_factura', ConsultarDetalleVenta);
app.get('/Consultar-venta-especifica', ConsultarVentaEspecifica);

//Módulo de Inventarios
app.get('/consultar-inventario', ConsultarInventario);
app.post('/generar-inventario', verificarToken, GenerarInventario);
app.get('/inventario-pdf/:id', GenerarPDFInventario); 
app.get('/inventario-pdf-descargar/:id', GenerarPDFInventarioDescargar);
app.get('/consultar-inventario-por-fecha', ConsultarInventarioPorFecha);

// ====== NUEVAS RUTAS PARA INVENTARIO AUTOMÁTICO ======

// Ruta para generar inventario automáticamente (sin token - para uso interno/cron)
app.post('/generar-inventario-automatico', async (req, res) => {
  try {
    console.log(`🔄 [${new Date().toLocaleString('es-CO')}] Solicitud manual de inventario automático recibida`);
    const resultado = await GenerarInventarioAutomatico();
    
    if (resultado.success) {
      return res.status(200).json({
        success: true,
        mensaje: 'Inventario automático generado exitosamente',
        data: resultado.data
      });
    } else {
      return res.status(400).json({
        success: false,
        mensaje: resultado.message
      });
    }
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleString('es-CO')}] Error en ruta de inventario automático:`, error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor'
    });
  }
});

// Ruta para verificar el estado del sistema cron (solo para administradores)
app.get('/verificar-estado-cron', verificarToken, validarGerente, (req, res) => {
  try {
    verificarEstadoCron();
    
    return res.status(200).json({
      success: true,
      mensaje: 'Estado del cron job verificado exitosamente',
      timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      configuracion: {
        horario: '8:00 AM todos los días',
        zona_horaria: 'America/Bogota',
        estado: 'Activo'
      }
    });
  } catch (error) {
    console.error('Error al verificar estado del cron:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al verificar el estado del cron job'
    });
  }
});

// Ruta para probar la conexión a la base de datos (solo para administradores)
app.get('/probar-conexion-bd', verificarToken, validarGerente, async (req, res) => {
  try {
    const conexionOK = await probarConexionDB();
    
    if (conexionOK) {
      return res.status(200).json({
        success: true,
        mensaje: 'Conexión a la base de datos exitosa',
        timestamp: new Date().toLocaleString('es-CO')
      });
    } else {
      return res.status(500).json({
        success: false,
        mensaje: 'Error de conexión a la base de datos'
      });
    }
  } catch (error) {
    console.error('Error al probar conexión:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno al probar la conexión'
    });
  }
});

// Ruta para ejecutar una prueba del cron job (solo para administradores)
app.post('/probar-cron-job', verificarToken, validarGerente, (req, res) => {
  try {
    probarCronJob();
    
    return res.status(200).json({
      success: true,
      mensaje: 'Prueba de cron job programada para ejecutarse en 30 segundos',
      timestamp: new Date().toLocaleString('es-CO'),
      nota: 'Revisa los logs del servidor para ver los resultados de la prueba'
    });
  } catch (error) {
    console.error('Error al programar prueba del cron:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al programar la prueba del cron job'
    });
  }
});

// Ruta para obtener estadísticas del sistema de inventario automático
app.get('/estadisticas-inventario-automatico', verificarToken, validarGerente, async (req, res) => {
  try {
    // Aquí puedes agregar lógica para obtener estadísticas desde la BD
    // Por ejemplo: inventarios generados automáticamente vs manuales
    
    return res.status(200).json({
      success: true,
      mensaje: 'Estadísticas del sistema de inventario automático',
      data: {
        sistema_activo: true,
        horario_configurado: '8:00 AM',
        zona_horaria: 'America/Bogota',
        ultima_verificacion: new Date().toLocaleString('es-CO'),
        // Aquí podrías agregar más estadísticas desde la BD
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al obtener estadísticas del sistema'
    });
  }
});

// Estadisticas 
app.get('/categorias-con-valor', obtenerCategoriasConValor);
app.get('/productos/mas-stock', obtenerTopProductosMasStock);
app.get('/productos/menos-stock', obtenerTopProductosMenosStock);
app.get('/inventarios-ultimos-7-dias', obtenerInventariosUltimos7Dias);

// Formulario de contacto
app.post('/contacto', handleContactForm);

// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo en puerto ${port}`);
  console.log(`🕐 Sistema de inventario automático configurado para ejecutarse a las 8:00 AM diariamente`);
  console.log(`🌐 Zona horaria: America/Bogota`);
});

// ====== MANEJO GRACEFUL DE CIERRE DEL SERVIDOR ======
process.on('SIGINT', () => {
  console.log(`🛑 [${new Date().toLocaleString('es-CO')}] Cerrando servidor...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`🛑 [${new Date().toLocaleString('es-CO')}] Cerrando servidor...`);
  process.exit(0);
});