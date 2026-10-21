
import duckdb
from pathlib import Path


def explorar_bases_datos():
    # Ruta de la carpeta actual del proyecto
    carpeta_proyecto = Path(__file__).resolve().parent.parent

    # La carpeta muestra_1000 está al mismo nivel que
    # actualizacion_viz-oja_09_14
    carpeta_bases = carpeta_proyecto.parent / "muestra_1000"

    print("=" * 70)
    print("EXPLORADOR DE BASES DE DATOS DUCKDB - PROYECTO OJA")
    print("=" * 70)
    print(f"\nCarpeta del proyecto: {carpeta_proyecto}")
    print(f"Carpeta de las bases: {carpeta_bases}")

    # Comprobar que la carpeta existe
    if not carpeta_bases.exists():
        print("\nERROR: No se encontró la carpeta muestra_1000.")
        print("Comprueba que esté al mismo nivel que la carpeta del proyecto.")
        return

    # Buscar todos los archivos DuckDB
    archivos = sorted(carpeta_bases.glob("*.duckdb"))

    if not archivos:
        print("\nNo se encontraron archivos .duckdb.")
        return

    print(f"\nBases de datos encontradas: {len(archivos)}")

    # Recorrer cada base de datos
    for archivo in archivos:
        print("\n" + "=" * 70)
        print(f"BASE DE DATOS: {archivo.name}")
        print("=" * 70)

        try:
            # Abrir en modo de solo lectura para proteger los datos
            with duckdb.connect(
                str(archivo),
                read_only=True
            ) as conexion:

                tablas = conexion.execute("SHOW TABLES").fetchall()

                if not tablas:
                    print("Esta base de datos no contiene tablas.")
                    continue

                print(f"Cantidad de tablas: {len(tablas)}")

                # Mostrar las tablas y sus columnas
                for (tabla,) in tablas:
                    print(f"\n  TABLA: {tabla}")
                    print("  " + "-" * 50)

                    columnas = conexion.execute(
                        f'DESCRIBE "{tabla}"'
                    ).fetchall()

                    for columna in columnas:
                        nombre = columna[0]
                        tipo = columna[1]
                        permite_nulos = columna[2]

                        print(
                            f"    {nombre:<30} "
                            f"Tipo: {tipo:<20} "
                            f"Nullable: {permite_nulos}"
                        )

        except Exception as error:
            print(f"\nNo se pudo leer esta base de datos: {error}")

    print("\n" + "=" * 70)
    print("EXPLORACIÓN FINALIZADA")
    print("=" * 70)


if __name__ == "__main__":
    explorar_bases_datos()
