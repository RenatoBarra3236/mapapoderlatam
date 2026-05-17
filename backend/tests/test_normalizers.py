from ingestion.normalizers import canonicalize_name, normalize_rut


def test_normalize_rut():
    assert normalize_rut("76.111.000-k") == "76111000-K"


def test_canonicalize_name():
    assert canonicalize_name("  Municipalidad  de Ñuñoa ") == "municipalidad de nunoa"
