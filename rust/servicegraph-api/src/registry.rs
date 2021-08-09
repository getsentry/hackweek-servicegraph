use uuid::Uuid;


pub fn register_host(project_id: u64, existing_id: &Option<String>, service_name: &String) -> Uuid {
    return match existing_id {
        Some(str_uuid) => {
            let parsed_uuid_opt = Uuid::parse_str(str_uuid);
            match parsed_uuid_opt{
                Ok(parsed_uuid) => parsed_uuid,
                Err(_) => Uuid::new_v4()
            }
        },
        None => Uuid::new_v4()
    };
}