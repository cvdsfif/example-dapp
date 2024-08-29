import { useEffect, useRef, useState } from "react"
import { NzComTact } from "./contracts/tact_NzComTact";
import { useTonContract } from "./hooks/useTonContract";
import { OpenedContract, toNano } from "@ton/core";
import { TonConnectButton, TonConnectUIProvider } from "@tonconnect/ui-react";
import { useTonConnectSender } from "./hooks/useTonConnectSender";

export const AMOUNT_FOR_GAS = toNano("0.02")

const ConnectedComponent = () => {
  const CONTRACT_MAINNET_ADDRESS = "EQB6M4YDpEO2t_E2jvKdgHq2ktLzNo5i57Khs7iVr-HrkrKH"
  const CONTRACT_TESTNET_ADDRESS = "EQA9dUWjN-Q_rPJv1e2SVs1WCYue0Llz9VYgty3ih14wRPF5"

  const [contractAmount, setContractAmount] = useState<bigint | undefined>(undefined)
  const [contractAddress, setContractAddress] = useState(CONTRACT_MAINNET_ADDRESS)

  const mainContract = useTonContract(
    contractAddress === CONTRACT_MAINNET_ADDRESS ? "mainnet" : "testnet",
    contractAddress,
    NzComTact
  )
  const mainContractRef = useRef<OpenedContract<NzComTact> | undefined>(undefined)
  mainContractRef.current = mainContract

  const [depositAmount, setDepositAmount] = useState<string | number | undefined>(0)
  const [withdrawAmount, setWithdrawAmount] = useState<number | string | undefined>(0)
  const [ownerConnected, setOwnerConnected] = useState(false)

  const sender = useTonConnectSender()
  const sendDeposit = async () => {
    await mainContract?.send(
      sender!, // If sender is not defined, the button is disabled and this function cannot be called
      {
        value: toNano(`${depositAmount}`),
      },
      {
        $$type: 'Deposit'
      }
    )
    setDepositAmount(0)
  }

  const refreshContract = async () => {
    const contract = mainContractRef.current
    if (!contract) return
    const contractAmount = await contract.getBalance()
    setContractAmount(contractAmount)
  }

  const readOwner = async () => {
    const contractOwner = await mainContract?.getOwner()
    setOwnerConnected(!!sender && sender?.address.toString() === contractOwner?.toString())
  }

  const sendWithdraw = async () => {
    await mainContract?.send(
      sender!,
      {
        value: AMOUNT_FOR_GAS,
      },
      {
        $$type: 'Withdrawal',
        amount: toNano(`${withdrawAmount}`)
      }
    )
    setWithdrawAmount(0)
  }

  useEffect(() => {
    readOwner()
  }, [mainContract, sender])

  useEffect(() => {
    refreshContract()
  }, [mainContract])

  useEffect(() => {
    const REFRESH_INTERVAL = 15_000
    const handler = setInterval(() => { refreshContract() }, REFRESH_INTERVAL)
    return () => clearInterval(handler)
  }, [])

  const toTonString = (amount: bigint) => `${Math.round(Number(amount / 1_000_000_000n))
    } TON ${Intl.NumberFormat("en-GB").format(amount % 1_000_000_000n)} nano`

  return <>
    <table>
      <tbody>
        <tr>
          <td>Contract balance:</td>
          <td data-testid="contractAmount">{contractAmount ? toTonString(contractAmount) : "Loading..."}</td>
        </tr>
        <tr>
          <td>Network:</td>
          <td>
            <input
              type="radio"
              id="mainnetSelector"
              name="networkSelector"
              data-testid="mainNetSelector"
              checked={contractAddress === CONTRACT_MAINNET_ADDRESS}
              onChange={() => setContractAddress(CONTRACT_MAINNET_ADDRESS)}
            />
            <label htmlFor="mainnetSelector">Mainnet</label>
            <input
              type="radio"
              id="testnetSelector"
              name="networkSelector"
              data-testid="testNetSelector"
              checked={contractAddress === CONTRACT_TESTNET_ADDRESS}
              onChange={() => setContractAddress(CONTRACT_TESTNET_ADDRESS)}
            />
            <label htmlFor="testnetSelector">Testnet</label>
          </td>
        </tr>
        <tr>
          <td>Deposit TON:</td>
          <td>
            <input
              data-testid="depositInput"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
            /><button
              data-testid="depositButton"
              onClick={() => sendDeposit()}
              disabled={!sender || !(Number(depositAmount) > 0)}
            >Send</button>
          </td>
        </tr>
        <tr>
          <td>Withdraw TON:</td>
          <td>
            <input
              data-testid="withdrawInput"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              disabled={!ownerConnected}
            /><button
              data-testid="withdrawButton"
              onClick={() => sendWithdraw()}
              disabled={!sender || !(Number(withdrawAmount) > 0) || !ownerConnected}
            >Send</button>
          </td>
        </tr>
        <tr>
          <td colSpan={2}>
            <TonConnectButton />
          </td>
        </tr>
      </tbody>
    </table>
  </>
}

function App() {
  return <TonConnectUIProvider manifestUrl="https://www.zykov.com/manifest.json">
    <ConnectedComponent />
  </TonConnectUIProvider>
}

export default App
