use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = DatastoreCore, js_name = MemoryDatastore)]
    pub type MemoryDatastore;

    #[wasm_bindgen(constructor)]
    pub fn new() -> MemoryDatastore;

    #[wasm_bindgen(js_namespace = BlockstoreCore, js_name = MemoryBlockstore)]
    pub type MemoryBlockstore;

    #[wasm_bindgen(constructor)]
    pub fn new() -> MemoryBlockstore;

    #[wasm_bindgen(js_namespace = window, js_name = getHelia)]
    pub fn get_helia() -> JsValue;
}
