const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const app = express();
const port = 3000;
const  upload  = require('./multer');
const bodyParser = require('body-parser');
const {solicitarRecuperacion, cambiarContrasena } = require('./InicioController/RecuperarContrasena');
const { solicitarOTP, reenviarOTP, verificarOTPHandler } = require('./InicioController/OTP');
const { login } = require('./InicioController/Login');
const { obtenerNombre } = require('./InicioController/GeneralInicio');
const { verificarToken, verificarTokenOpcional } = require('./InicioController/middleware');
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
const { RegistrarVenta, ValidarClientePorCedula, BuscarProductoVentaPorReferencia, BuscarCalcomaniaVentaPorId } = require('./VentasController/RegistrarVenta');
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
const { RegistrarCalcomaniaUsuario } = require('./CalcomaniasController/RegistrarCalcomaniaUsuario');
const { AgregarCalcomaniaCarrito } = require('./CalcomaniasController/AgregarCalcomaniaCarrito');
const { ConsultarCarrito } = require('./CarritoController/ConsultarCarrito');
const { ActualizarCarrito } = require('./CarritoController/ActualizarCarrito');
const { EliminarItemCarrito } = require('./CarritoController/EliminarCarrito');
const { ConsultarSubcategoriasPorCategoria } = require('./NavbarController/ConsultarSubcategoriasPorCategorias');
const {  obtenerProductosPorSubcategoria } = require('./NavbarController/ConsultarProductoPorSubcategoria');
const { ConsultarCalcomaniasPorRol } = require('./NavbarController/ConsultarCalcomaniasPorRol');
const {  obtenerProductosPorMarca } = require('./NavbarController/ConsultarProductosPorMarca');
const { AgregarCalcomaniasStaff } = require('./NavbarController/AgregarCalcomaniasStaff');
const { AgregarProductoAlCarrito } = require('./NavbarController/AgregarProducto');
const { ConsultarProductoPorReferencia } = require('./NavbarController/ConsultarProductoPorReferencia');
const { ConsultarCalcomaniaPorId } = require('./NavbarController/ConsultarCalcomaniaPorId');
const { DireccionEnvio } = require('./ComprasController/DireccionEnvio');
const { ConsultarCarritoYResumen} = require('./ComprasController/DatosCompra');
const { handleWompiWebhook } = require('./ComprasController/WompiController');
const { createCheckout, getOrderStatus } = require('./ComprasController/PagoWompi');
const { forzarLimpiezaFacturas } = require('./ComprasController/FinalizacionCompra');
const { iniciarVerificacionDeFacturas } = require('./ComprasController/FinalizacionCompra');
const { obtenerUltimaDireccion } = require('./ComprasController/ConsultarUltimaDireccion');
const { ObtenerMarcasPorSubcategoria, ObtenerProductosPorFiltro } = require('./NavbarController/FiltroPorMarca');
const { obtenerProductosPorCategoria } = require('./NavbarController/ProductosPorCategoria');
const { obtenerMisCompras } = require('./InicioController/HistorialPedidos');
const { registrarCalificacion } = require('./InicioController/RegistrarCalificacion');
const { infoChat } = require('./ChatBotController/InformcionChat');

app.use(cors({
  origin: ['http://localhost:5173', 'https://accesorios-apolo-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'un_secreto_predeterminado_muy_seguro_si_no_hay_env', // <-- ¡CRÍTICO! Usa una variable de entorno.
    resave: false, // No guardar la sesión si no ha sido modificada
    saveUninitialized: false, // No crear sesiones para solicitudes no inicializadas
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true en producción (requiere HTTPS)
        httpOnly: true, // No permitir acceso al cliente desde JavaScript
        maxAge: 1000 * 60 * 60 * 24 // 1 día de duración de la sesión (ajusta si es necesario)
    }
}));




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

// Historial de Pedidos
app.get('/historial-pedidos', verificarToken, obtenerMisCompras)

// Calificaciones
app.post('/calificar', verificarToken, registrarCalificacion);

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
app.post('/registrar-calcomania-Usuario', verificarToken, upload.single('imagen'), RegistrarCalcomaniaUsuario);
app.get('/calcomanias', ConsultarCalcomania);
app.post('/obtener-calcomania', ObtenerDatosCalcomania);
app.put('/actualizar-calcomania', upload.single('imagen'), ActualizarCalcomania);
app.put('/eliminar-calcomania', EliminarCalcomania);
app.put('/reactivar-calcomania', ReactivarCalcomania);
app.get('/buscar-calcomania-nombre', BuscarCalcomaniaPorNombre);
app.get('/calcomanias-usuario',verificarToken, ConsultarCalcomaniasPorUsuario);
app.delete('/eliminar-calcomanias/:id_calcomania', EliminarCalcomaniaUsuario);
app.put('/editar-nombre-calcomanias/:id_calcomania', EditarNombreCalcomania);
app.put('/calcomanias/actualizar-y-agregar-carrito', verificarToken, AgregarCalcomaniaCarrito);


//Módulo de Ventas
app.post('/registrar-venta',  RegistrarVenta);
app.get('/validar-cliente-venta', ValidarClientePorCedula);
app.get('/buscar-producto-venta-referencia', BuscarProductoVentaPorReferencia);
app.get('/buscar-calcomania-venta-id', BuscarCalcomaniaVentaPorId); // Asumiendo que esta ruta es para buscar calcomanías por referencia
app.get('/Consultar-ventas', ConsultarVenta);
app.get('/Consultar-detalle-venta/:id_factura', ConsultarDetalleVenta);
app.get('/Consultar-venta-especifica', ConsultarVentaEspecifica);


//Módulo de Inventarios
app.get('/consultar-inventario', ConsultarInventario);
app.post('/generar-inventario', verificarToken, GenerarInventario);
app.get('/inventario-pdf/:id', GenerarPDFInventario); 
app.get('/inventario-pdf-descargar/:id', GenerarPDFInventarioDescargar);
app.get('/consultar-inventario-por-fecha', ConsultarInventarioPorFecha);
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


// Estadisticas 
app.get('/categorias-con-valor', obtenerCategoriasConValor);
app.get('/productos/mas-stock', obtenerTopProductosMasStock);
app.get('/productos/menos-stock', obtenerTopProductosMenosStock);
app.get('/inventarios-ultimos-7-dias', obtenerInventariosUltimos7Dias);

// Carrito de compras
app.get('/consultar-carrito-usuario', verificarToken, ConsultarCarrito);
app.put('/actualizar-cantidad-carrito', verificarToken, ActualizarCarrito);
app.delete('/carrito/:id_carrito_item', verificarToken, EliminarItemCarrito);

// Navbar
app.get('/subcategorias-por-categoria-por-nombre/:nombre_categoria', ConsultarSubcategoriasPorCategoria);
app.get('/productos-por-subcategoria/:nombre_subcategoria', obtenerProductosPorSubcategoria);
app.get('/calcomanias/staff', ConsultarCalcomaniasPorRol);
app.get('/productos-por-marca/:marca', obtenerProductosPorMarca);
app.post('/agregar-calcomanias-staff', verificarToken, AgregarCalcomaniasStaff);
app.post('/agregar-producto-carrito', verificarToken, AgregarProductoAlCarrito);
app.get('/consultar-producto-por-referencia/:referencia', ConsultarProductoPorReferencia);
app.get('/consultar-calcomanias-por-id/:id', ConsultarCalcomaniaPorId);
app.get('/obtener-marca/:nombre_subcategoria', ObtenerMarcasPorSubcategoria);
app.get('/productos-por-subcategoria-y-marca', ObtenerProductosPorFiltro);
app.get('/productos-por-categoria/:nombre_categoria', obtenerProductosPorCategoria);


// Compras
app.post('/direccion-envio', verificarTokenOpcional, DireccionEnvio);
app.get('/carrito-resumen', verificarTokenOpcional, ConsultarCarritoYResumen);
app.post('/create-checkout', createCheckout);
app.get('/estado-orden/:id_factura/status', getOrderStatus);
app.post('/webhook/wompi', handleWompiWebhook); 
app.post('/forzar-limpieza-facturas', verificarToken, forzarLimpiezaFacturas);
app.get('/ultima-direccion', verificarToken, obtenerUltimaDireccion);

//Chatbot
app.post('/chatbot', infoChat);



// Formulario de contacto
app.post('/contacto', handleContactForm);

// Inicializar servidor
app.listen(port, () => {
  console.log(`✅ Servidor corriendo`);

    iniciarVerificacionDeFacturas();

});
