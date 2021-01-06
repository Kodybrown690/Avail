// Substrate-lite
// Copyright (C) 2019-2021  Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: GPL-3.0-or-later WITH Classpath-exception-2.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import * as child_process from 'child_process';
import * as fs from 'fs';

// The important step in this script is running `cargo build --target wasm32-wasi` on the Rust
// code. This generates a `wasm` file in `target/wasm32-wasi`.
//
// Note: the Rust version is pinned because the wasi target is still unstable. Without pinning, it
// is possible for the wasm-js bindings to change between two Rust versions. Feel free to update
// this version pin whenever you like, provided it continues to build.
child_process.execSync(
    "cargo +1.48.0 build --package substrate-lite-js --target wasm32-wasi --no-default-features --release",
    { 'stdio': 'inherit' }
);

// It is then picked up by `wasm-opt`, which optimizes it and generates `./autogen/tmp.wasm`.
// `wasm_opt` is purely about optimizing. If it isn't available, it is also possible to directly
// use the `.wasm` generated by the Rust compiler.
try {
    child_process.execSync(
        "wasm-opt -o autogen/tmp.wasm -Os --strip-debug --vacuum --dce ../../../target/wasm32-wasi/release/substrate_lite_js.wasm",
        { 'stdio': 'inherit' }
    );
} catch(error) {
    console.warn("Failed to run `wasm-opt`. Using the direct Rust output instead.");
    console.warn(error);
    fs.copyFileSync("../../../target/wasm32-wasi/release/substrate_lite_js.wasm", "./autogen/tmp.wasm");
}

// We then base64-encode the `.wasm` file, and put this base64 string as a constant in
// `./autogen/wasm.js`. It will be decoded at runtime.
let wasm_opt_out = fs.readFileSync('./autogen/tmp.wasm');
let base64_data = wasm_opt_out.toString('base64');
fs.writeFileSync('./autogen/wasm.js', 'export default "' + base64_data + '";');
fs.unlinkSync("./autogen/tmp.wasm");

// The reason for this script is that at the time of writing, there isn't any standard
// cross-platform solution to the problem of importing WebAssembly files. Base64-encoding the
// .wasm file and integrating it as a string is the safe but non-optimal solution.