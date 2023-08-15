import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceModal from './DeviceConnectionModal';
import PulseIndicator from './PulseIndicator';
import useBLE from './useBLE';
import { atob } from 'react-native-quick-base64';

const App = () => {
  const {
    requestPermissions,
    scanForPeripherals,
    allDevices,
    connectToDevice,
    connectedDevice,
    heartRate,
    disconnectFromDevice,
    availableServices,
    getServicesAndCharacteristicsData
  } = useBLE();

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [extensionData, setExtensionData] = useState<any>({ title: '', subTitle: '' });

  const scanForDevices = () => {
    requestPermissions(isGranted => {
      if (isGranted) {
        scanForPeripherals();
      }
    });
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const openModal = async () => {
    scanForDevices();
    setIsModalVisible(true);
  };

  const onBottomButtonPress = () => {
    if (connectedDevice) {
      setStreaming(false);
      disconnectFromDevice()
    } else openModal()
  }

  const returnServiceName = (uuid: string) => {
    if (uuid?.includes("00002a19"))
      return "Battery Level"
    else if (uuid?.includes("0000fea1"))
      return "Walking Steps"
    else if (uuid?.includes("0000fee1"))
      return "Unknown"
    else if (uuid?.includes("00002a37"))
      return "Heart Rate"
    else return "Other service"
  }

  const handleExtension = (uuid: string) => {
    if (uuid.includes("00002a19"))
      return "%";
    //setExtensionData({ title: "Battery Level is: ", subTitle: "%" })
    else if (uuid.includes("0000fea1"))
      return "Steps";
    // setExtensionData({ title: "Your steps are: ", subTitle: "Steps" })
    else if (uuid.includes("0000fee1"))
      return "Max steps";
    // setExtensionData({ title: "Your Activity is: ", subTitle: "" })
    else if (uuid.includes("00002a37"))
      return "Bpm";
    // setExtensionData({ title: "Your heart rate is: ", subTitle: "Bpm" })
    else return "";
  }

  const formatCharacteristicValue = (characteristic: any) => {
    if (characteristic.uuid.includes("00002a19")) {
      // this is for battery
      const rawData = atob(characteristic.value);
      let innerHeartRate: number = -1;
      innerHeartRate = rawData[0].charCodeAt(0);
      return innerHeartRate
    } else if (characteristic.uuid.includes("0000fee1")) {
      // this is for step counter real steps
      const rawData = atob(characteristic.value);
      console.log({ rawData });
      let innerHeartRate: number = -1;
      const firstBitValue: number = Number(rawData) & 0x01;
      console.log({ firstBitValue });
      if (firstBitValue === 0) {
        innerHeartRate = rawData[0].charCodeAt(0);
        console.log({ innerHeartRate });
      } else {
        innerHeartRate =
          Number(rawData[1].charCodeAt(0) << 8) +
          Number(rawData[2].charCodeAt(2));
      }
      return innerHeartRate
    } else {
      // this is for step counter max steps
      const rawData = atob(characteristic.value);
      console.log({ rawData });
      let innerHeartRate: number = -1;
      const firstBitValue: number = Number(rawData) & 0x01;
      console.log({ firstBitValue });
      if (firstBitValue === 0) {
        innerHeartRate = rawData[1].charCodeAt(0);
        console.log({ innerHeartRate });
      } else {
        innerHeartRate =
          Number(rawData[1].charCodeAt(0) << 8) +
          Number(rawData[2].charCodeAt(2));
      }
      return innerHeartRate
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heartRateTitleWrapper}>
        {!connectedDevice &&
          <Text style={styles.heartRateTitleText}>
            Please Connect to your smart watch to monitor activities
          </Text>
        }
        {!streaming && connectedDevice && availableServices &&
          <View style={{ marginTop: 64 }}>
            <Text style={styles.heartRateTitleText}>{"Available Services"}</Text>
            <Text style={styles.heartRateTitleText2}>{""}</Text>

            <FlatList
              data={availableServices}
              numColumns={2}
              renderItem={({ item, index }) => {
                return <TouchableOpacity
                  // onPress={() => { getServicesAndCharacteristicsData(item.serviceUUID, item.uuid, connectedDevice); setStreaming(true); handleExtension(item.uuid) }}
                  style={styles.serviceList}>
                  <Text style={styles.serviceListText2}>{returnServiceName(item?.uuid)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.serviceListText}>{formatCharacteristicValue(item)}</Text>
                    <Text style={styles.serviceListText}>{handleExtension(item.uuid)}</Text>
                  </View>
                </TouchableOpacity>
              }} />

            {/* {availableServices?.map((x: any) => {
              return <TouchableOpacity onPress={() => { getServicesAndCharacteristicsData(x.serviceUUID, x.uuid); setStreaming(true); handleExtension(x.uuid) }} style={styles.serviceList}>
                <Text style={styles.serviceListText}>{returnServiceName(x?.uuid)}</Text>
              </TouchableOpacity>
            })} */}
          </View>
        }
        {!streaming && availableServices.length == 0 && connectedDevice && <ActivityIndicator />}
        {streaming &&
          <>
            <Text style={styles.heartRateTitleText}>{extensionData.title}</Text>
            <Text style={styles.heartRateText}>{heartRate} {extensionData.subTitle}</Text>
          </>
        }
      </View>

      <TouchableOpacity
        onPress={() => onBottomButtonPress()}
        style={styles.ctaButton}>
        <Text style={styles.ctaButtonText}>
          {connectedDevice ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
      <DeviceModal
        closeModal={hideModal}
        visible={isModalVisible}
        connectToPeripheral={connectToDevice}
        devices={allDevices}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  heartRateTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartRateTitleText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 20,
    color: 'black',
  },
  heartRateTitleText2: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    color: 'black',
  },
  heartRateText: {
    fontSize: 25,
    marginTop: 15,
    color: 'black',
  },
  serviceListText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 3,
    color: 'black',
  },
  serviceListText2: {
    fontSize: 14,
    
    color: 'black',

  },
  ctaButton: {
    backgroundColor: 'green',
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    marginHorizontal: 20,
    marginBottom: 5,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  serviceList: {
    marginVertical: 4, backgroundColor: 'orange', paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
    width: 140,
    height: 140,
    borderRadius: 4,
    padding: 4, marginHorizontal: 6,
  }
});

export default App;