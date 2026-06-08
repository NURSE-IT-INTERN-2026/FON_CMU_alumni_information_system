-- Update model_representatives cohort values from long names to short names
UPDATE model_representatives SET cohort = 'ปริญญาพยาบาล' WHERE cohort = 'รายชื่อเครือข่ายศิษย์เก่าปริญญาพยาบาล';
UPDATE model_representatives SET cohort = 'ผู้ช่วยพยาบาล' WHERE cohort = 'รายชื่อเครือข่ายศิษย์เก่าผู้ช่วยพยาบาล';
UPDATE model_representatives SET cohort = 'อนุปริญญาพยาบาล' WHERE cohort = 'รายชื่อเครือข่ายศิษย์เก่าอนุปริญญาพยาบาล';
UPDATE model_representatives SET cohort = 'ปริญญาโท' WHERE cohort = 'รายชื่อเครือข่ายศิษย์เก่าปริญญาโท';
UPDATE model_representatives SET cohort = 'ปริญญาเอก' WHERE cohort = 'รายชื่อเครือข่ายศิษย์เก่าปริญญาเอก';
