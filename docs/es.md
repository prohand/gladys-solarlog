# Solar-Log

Siga su instalación solar en Gladys con un registrador **Solar-Log** (Solar-Log 200, 250, 300,
500, 1000, 1200, 1900, 2000, Solar-Log Base…): producción, consumo, excedente, balances,
inversores y batería. La integración lee el Solar-Log **en su red local** a través de su interfaz
JSON abierta: sin cuenta en la nube, ningún dato sale de su casa.

## Lo que obtiene

- Un dispositivo **Solar-Log**: potencia de producción, potencia DC, tensiones AC y DC,
  producción total (contador en kWh) y — si hay un contador de consumo conectado al Solar-Log —
  potencia consumida, consumo total, excedente (producción menos consumo) y tasa de autoconsumo.
- Un dispositivo **por inversor** con su potencia instantánea (opcional).
- Un dispositivo **batería** (nivel, potencia de carga y de descarga) si el Solar-Log gestiona
  una.
- **Disparadores de escena**: producción iniciada / detenida, excedente solar disponible /
  terminado, Solar-Log inaccesible / accesible de nuevo.
- **Acciones de escena**: leer los valores solares, comprobar el excedente solar, obtener la
  producción de un periodo.
- Dos **widgets** para el panel: «Producción solar» y «Balance solar».

La producción total se publica como índice de contador: el seguimiento de energía de Gladys
calcula a partir de él la producción de cualquier día, mes o año.

## Antes de empezar

1. Asigne al Solar-Log una **dirección IP fija** en su router (reserva DHCP).
2. Abra la página web del Solar-Log en un navegador (su dirección IP).
3. Vaya a **Configuración > Sistema > Control de acceso** y active **Interfaz JSON abierta**.
   Guarde. Sin ella, el Solar-Log no responde nada a la integración.
4. Opcional: si el nivel de acceso «usuario» está protegido por contraseña, anótela. Solo hace
   falta para los datos por inversor y de la batería.

## Configuración

En Gladys, abra **Integraciones > Solar-Log > Configuración**:

| Campo                          | Qué introducir                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Dirección del Solar-Log        | Dirección IP o nombre de host, p. ej. `192.168.1.20` (se añade `http://`).          |
| Contraseña de usuario          | Solo si el nivel «usuario» tiene contraseña. Se guarda como secreto.                |
| Intervalo de actualización (s) | Frecuencia de lectura del Solar-Log. 60 s por defecto, 30 s mínimo.                 |
| Umbral de producción           | Producción (W) que dispara «Producción solar iniciada». 50 W por defecto.           |
| Umbral de excedente            | Excedente (W) que dispara «Excedente solar disponible». 1000 W por defecto.         |
| Margen de excedente            | «Excedente terminado» se dispara en el umbral menos este margen. 200 W por defecto. |
| Un dispositivo por inversor    | Crea también un dispositivo por inversor. Activado por defecto.                     |

Después haga clic en **Probar la conexión**: la respuesta muestra la producción actual y la del
día. Abra la pestaña **Detección** y añada los dispositivos que quiera. **Buscar de nuevo los
inversores** vuelve a leer los inversores y la batería tras un cambio en el Solar-Log.

## Disparadores de escena

| Disparador                   | Cuándo                                                           | Variables                                    |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Producción solar iniciada    | La producción supera el umbral de producción (por la mañana).    | `production_w`                               |
| Producción solar detenida    | La producción baja de la mitad del umbral (por la tarde).        | `yield_today_kwh`                            |
| Excedente solar disponible   | Producción menos consumo alcanza el umbral de excedente.         | `surplus_w`, `production_w`, `consumption_w` |
| Excedente solar terminado    | El excedente baja del umbral menos el margen.                    | `surplus_w`, `production_w`, `consumption_w` |
| Solar-Log inaccesible        | Tres lecturas seguidas fallaron. Filtre por el motivo si quiere. | `reason`                                     |
| Solar-Log accesible de nuevo | El Solar-Log vuelve a responder.                                 |                                              |

Cada disparador se activa **una vez por cambio**, nunca en cada lectura, y no al reiniciar la
integración. Los disparadores de excedente necesitan un contador de consumo en el Solar-Log.

## Acciones de escena

- **Leer los valores solares**: lee el Solar-Log ahora. Salidas: `reachable`, `production_w`,
  `consumption_w`, `surplus_w`, `yield_today_kwh`, `self_consumption_percent`.
- **Comprobar el excedente solar**: ¿alcanza el excedente el mínimo elegido? Salidas: `available`
  (nunca verdadero si el Solar-Log no responde), `surplus_w`.
- **Obtener la producción solar**: producción y consumo en kWh de hoy, ayer, este mes, este año
  o desde la instalación.

Ejemplo: «Cuando haya excedente solar disponible, entre las 10:00 y las 16:00, encender el
enchufe del termo eléctrico; cuando el excedente termine, apagarlo.»

## Widgets del panel

- **Producción solar**: producción, consumo y excedente en directo, parte de la potencia pico,
  gráfico de 24 horas, producción del día, estado del enlace y botón **Actualizar**.
- **Balance solar**: producción y consumo de hoy, ayer, este mes, este año y en total, más el
  autoconsumo actual.

## Solución de problemas

- **«La interfaz JSON abierta está desactivada»**: actívela (vea «Antes de empezar»).
- **«El Solar-Log no responde»**: compruebe la dirección, que Gladys y el Solar-Log estén en la
  misma red y que ningún cortafuegos bloquee el puerto 80.
- **«El Solar-Log rechazó la contraseña»**: compruebe la contraseña del nivel «usuario». El
  resumen de la instalación funciona sin ella; solo los inversores y la batería la necesitan.
- **Valores a 0 justo después de reiniciar el Solar-Log**: la integración los ignora a propósito
  hasta que el Solar-Log termina de arrancar.
- **Ningún dispositivo inversor**: los datos por inversor pueden requerir la contraseña; haga
  clic en **Buscar de nuevo los inversores** tras introducirla.

## Privacidad

Todo se queda en su red: la integración solo habla con su Solar-Log. La contraseña se guarda como
secreto de Gladys y nunca se escribe en los registros.
