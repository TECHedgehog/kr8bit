from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/kr8bit.db"
    scraper_base_url: str = "https://fitgirl-repacks.site"
    scraper_posts_per_page: int = 100
    scraper_delay_seconds: float = 1.0
    scrape_interval_hours: int = 6

    qbittorrent_host: str = "http://localhost:8090"
    qbittorrent_user: str = "admin"
    qbittorrent_pass: str = "adminadmin"
    qbit_sync_interval_seconds: int = 30

    scraper_report_path: str = "data/scrape_report.csv"

    enrichment_enabled: bool = True
    enrichment_batch_size: int = 50
    enrichment_concurrency: int = 10

    igdb_rate_limit: int = 4

    twitch_client_id: str = ""
    twitch_client_secret: str = ""

    steamgriddb_api_key: str = ""

    cors_origins: list[str] = ["*"]

    game_category_ids: list[int] = [5, 42, 43, 319]

    library_path: str = "/library"
    downloads_path: str = "/downloads"
    library_scan_interval_hours: int = 0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
