# Data model (current)

Source of truth: `supabase/schema.sql`.

## app_users
| field                 | type        | notes                         |
|-----------------------|-------------|-------------------------------|
| id                    | uuid        | primary key                   |
| auth_user_id          | uuid        | Supabase auth user id (unique)|
| name                  | text        | required                      |
| first_name            | text        | optional                      |
| last_name             | text        | optional                      |
| email                 | text        | required, unique              |
| role                  | text        | admin or user                 |
| created_at            | timestamptz | default now()                 |
| last_modified_at      | timestamptz | optional                      |
| last_modified_by_id   | uuid        | FK to app_users (nullable)    |

## farms
| field         | type        | notes                                |
|---------------|-------------|--------------------------------------|
| id            | uuid        | primary key                          |
| name          | text        | required                             |
| admin_user_id | uuid        | FK to app_users (nullable)           |
| hq_location_id| uuid        | FK to locations (nullable)           |
| email         | text        | optional                             |
| phone         | text        | optional                             |
| website_url   | text        | optional                             |
| app_url       | text        | optional                             |
| favicon_url   | text        | optional                             |
| logo_url      | text        | optional                             |
| created_at    | timestamptz | default now()                        |

## locations
| field                       | type        | notes                           |
|-----------------------------|-------------|---------------------------------|
| id                          | uuid        | primary key                     |
| farm_id                     | uuid        | FK to farms                     |
| name                        | text        | required                        |
| code                        | text        | optional                        |
| is_primary                  | boolean     | default false                   |
| address_line1               | text        | optional                        |
| address_line2               | text        | optional                        |
| city                        | text        | optional                        |
| province                    | text        | optional                        |
| postal_code                 | text        | optional                        |
| country                     | text        | default 'Canada'                |
| latitude                    | numeric     | optional                        |
| longitude                   | numeric     | optional                        |
| nearest_town                | text        | optional                        |
| nearest_hospital_name       | text        | optional                        |
| nearest_hospital_distance_km| numeric     | optional                        |
| primary_contact_name        | text        | optional                        |
| primary_contact_phone       | text        | optional                        |
| emergency_instructions      | text        | optional                        |
| has_fuel_storage            | boolean     | default false                   |
| has_chemical_storage        | boolean     | default false                   |
| notes                       | text        | optional                        |
| created_at                  | timestamptz | default now()                   |
| last_modified_at            | timestamptz | optional                        |
| last_modified_by_id         | uuid        | FK to app_users (nullable)      |

## buildings
| field                | type        | notes                           |
|----------------------|-------------|---------------------------------|
| id                   | uuid        | primary key                     |
| farm_id              | uuid        | FK to farms                     |
| location_id          | uuid        | FK to locations                 |
| name                 | text        | required                        |
| code                 | text        | optional                        |
| type                 | text        | optional                        |
| description          | text        | optional                        |
| capacity             | text        | optional                        |
| year_built           | int         | optional                        |
| heated               | boolean     | optional                        |
| has_water            | boolean     | optional                        |
| has_three_phase_power| boolean     | optional                        |
| notes                | text        | optional                        |
| created_at           | timestamptz | default now()                   |
| last_modified_at     | timestamptz | optional                        |
| last_modified_by_id  | uuid        | FK to app_users (nullable)      |

## equipment
| field                | type    | notes                              |
|----------------------|---------|------------------------------------|
| id                   | uuid    | primary key                        |
| location_id          | uuid    | FK to locations (nullable)         |
| building_id          | uuid    | FK to buildings (nullable)         |
| category             | text    | required                           |
| make                 | text    | optional                           |
| model                | text    | optional                           |
| nickname             | text    | optional                           |
| serial_number        | text    | optional                           |
| year                 | int     | optional                           |
| unit_number          | text    | optional                           |
| vin_sn               | text    | optional                           |
| year_of_purchase     | int     | optional                           |
| license_class        | text    | optional                           |
| next_service_at      | date    | optional                           |
| cvip_expires_at      | date    | optional                           |
| insurance_expires_at | date    | optional                           |
| oil_filter_number    | text    | optional                           |
| fuel_filter_number   | text    | optional                           |
| air_filter_number    | text    | optional                           |
| active               | boolean | default true                       |
| notes                | text    | optional                           |

## maintenance_logs
| field            | type        | notes                         |
|------------------|-------------|-------------------------------|
| id               | uuid        | primary key                   |
| equipment_id     | uuid        | FK to equipment               |
| created_by_id    | uuid        | FK to app_users (nullable)    |
| title            | text        | required                      |
| description      | text        | optional                      |
| status           | text        | default 'open'                |
| logged_at        | timestamptz | default now()                 |
| maintenance_date | date        | optional                      |
| hours_on_meter   | numeric     | optional                      |
| next_due_at      | timestamptz | optional                      |
