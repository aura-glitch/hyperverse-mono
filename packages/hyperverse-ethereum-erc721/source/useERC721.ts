import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutationOptions } from 'react-query';
import { ethers } from 'ethers';
import { useEthereum } from '@decentology/hyperverse-ethereum';
import { ContractABI, CONTRACT_TESTNET_ADDRESS } from './Provider';
import { useEvent } from 'react-use';
import { useStorage } from '@decentology/hyperverse-storage-skynet';
import { createContainer, useContainer } from 'unstated-next';

type ContractState = ethers.Contract;

type MetaData = {
	name: string;
	description: string;
	image: string;
};

function ERC721State(initialState: { tenantId: string } = { tenantId: '' }) {
	const { tenantId } = initialState;
	const queryClient = useQueryClient();
	const { address, web3Provider, provider, connect } = useEthereum();
	const { clientUrl } = useStorage();
	const [contract, setExampleNFTContract] = useState<ContractState>(
		new ethers.Contract(CONTRACT_TESTNET_ADDRESS, ContractABI, provider) as ContractState
	);
	const { uploadFile } = useStorage();
	const setup = useCallback(async () => {
		const signer = await web3Provider?.getSigner();
		if (signer && contract) {
			const ctr = contract.connect(signer) as ContractState;
			setExampleNFTContract(ctr);
		}
	}, [web3Provider]);

	const errors = (err: any) => {
		if (!contract?.signer) {
			throw new Error('Please connect your wallet!');
		}

		if (err.code === 4001) {
			throw new Error('You rejected the transaction!');
		}

		if (err.message.includes('User is already in a Tribe!')) {
			throw new Error('You are already in a tribe!');
		}

		throw err;
		// throw new Error("Something went wrong!");
	};

	useEffect(() => {
		if (web3Provider) {
			setup();
		}
	}, [web3Provider]);

	// How do I connect all these calls to the proxy?

	const createInstance = useCallback(async (name: string, symbol: string) => {
		try {
			const createTxn = await contract.createInstance(name, symbol);
			return createTxn.wait();
		} catch (err) {
			errors(err);
			throw err;
		}
	}, [contract]);

	const mintNFT = useCallback(async () => {
		try {
			const mintNFT = await contract.getProxy(tenantId).createNFT();
			return mintNFT.wait();
		} catch (err) {
			errors(err);
			throw err;
		}
	}, [contract]);

	const getBalanceOf = useCallback(async (address) => {
		try {
			const balance = await contract.getProxy(tenantId).balanceOf(address);

			return balance.toNumber();
		} catch (err) {
			throw err;
		}
	}, [contract]);

	return {
		tenantId,
		contract,
		NewInstance: (
			options?: Omit<UseMutationOptions<unknown, unknown, unknown, unknown>, 'mutationFn'>
		) => useMutation((name: string, symbol: string) => createInstance(name, symbol), options),
		MintNFT: (
			options?: Omit<UseMutationOptions<unknown, unknown, void, unknown>, 'mutationFn'>
		) => useMutation(() => mintNFT(), options),
		BalanceOf: () =>
			useQuery(['getTribeId', contract?.address], (address) => getBalanceOf(address), {
				enabled: !!contract?.address,
				retry: false,
			}),
	};
}

export const ERC721 = createContainer(ERC721State);

export function useERC721() {
	return useContainer(ERC721);
}
