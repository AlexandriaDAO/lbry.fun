use candid::Principal;

fn main() {
    println!("Testing principals:");
    
    match Principal::from_text("54fqz-5iaaa-aaaap-qkmqa-cai") {
        Ok(p) => println!("54fqz-5iaaa-aaaap-qkmqa-cai is valid: {:?}", p),
        Err(e) => println!("54fqz-5iaaa-aaaap-qkmqa-cai is invalid: {:?}", e),
    };
    
    match Principal::from_text("j362g-ziaaa-aaaap-qkt7q-cai") {
        Ok(p) => println!("j362g-ziaaa-aaaap-qkt7q-cai is valid: {:?}", p),
        Err(e) => println!("j362g-ziaaa-aaaap-qkt7q-cai is invalid: {:?}", e),
    };
}