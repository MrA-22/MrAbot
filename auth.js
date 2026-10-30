import { initAuthCreds, BufferJSON } from "@whiskeysockets/baileys"
import Session from "./session.js"

export async function useMongoAuthState() {

  const writeData = async (data, key) => {
    // Mengubah data Buffer/Binary menjadi string JSON yang aman disimpan ke MongoDB
    const jsonStr = JSON.stringify(data, BufferJSON.replacer)
    await Session.findOneAndUpdate(
      { key },
      { value: jsonStr },
      { upsert: true }
    )
  }

  const readData = async (key) => {
    const data = await Session.findOne({ key })
    if (!data?.value) return null
    // Mengembalikan string JSON dari MongoDB menjadi objek asli Baileys
    return JSON.parse(data.value, BufferJSON.reviver)
  }

  // Jika database kosong, buat kredensial baru dengan initAuthCreds(), BUKAN {}
  const creds = (await readData("creds")) || initAuthCreds()

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        let data = {}
        for (let id of ids) {
          let value = await readData(type + "-" + id)
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          data[id] = value
        }
        return data
      },
      set: async (data) => {
        for (let type in data) {
          for (let id in data[type]) {
            const value = data[type][id]
            if (value) {
              await writeData(value, type + "-" + id)
            } else {
              await Session.deleteOne({ key: type + "-" + id })
            }
          }
        }
      }
    }
  }

  const saveCreds = async () => {
    await writeData(state.creds, "creds")
  }

  return { state, saveCreds }
}
